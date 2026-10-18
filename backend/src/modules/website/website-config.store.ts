import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildBrandConfigFromEnv, buildLocationConfigFromEnv } from '../../tenancy/tenant-config.defaults';
import { landingImageReferences, mergeWebsiteConfig, WebsiteConfig, WebsiteImage } from '../../contexts/platform/domain/services/website-media.policy';
import { WebsiteMediaCleanup } from './website-media-cleanup';
import { configRevision } from './config-revision';
import { ImagekitLandingFontAdapter } from './imagekit-landing-font.adapter';
import { PrepareLandingAppearanceUseCase } from '../../contexts/platform/application/use-cases/prepare-landing-appearance.use-case';
import { DomainError } from '../../shared/domain/domain-error';

export type WebsiteConfigState = { brand: WebsiteConfig; local: WebsiteConfig; effective: WebsiteConfig; revision: string };

@Injectable()
export class WebsiteConfigStore {
  private readonly logger = new Logger(WebsiteConfigStore.name);
  constructor(private readonly prisma: PrismaService, private readonly cleanup: WebsiteMediaCleanup, private readonly fonts: ImagekitLandingFontAdapter) {}

  async read(tx: Prisma.TransactionClient, brandId: string, localId: string): Promise<WebsiteConfigState> {
    const location = await tx.location.findFirst({ where: { id: localId, brandId }, select: { id: true } });
    if (!location) throw new NotFoundException('WEBSITE_NOT_FOUND');
    const [brandRow, localRow] = await Promise.all([
      tx.brandConfig.findUnique({ where: { brandId }, select: { data: true } }),
      tx.locationConfig.findUnique({ where: { localId }, select: { data: true } }),
    ]);
    const brand = (brandRow?.data ?? {}) as WebsiteConfig, local = (localRow?.data ?? {}) as WebsiteConfig;
    const effectiveBrand = mergeWebsiteConfig(buildBrandConfigFromEnv() as WebsiteConfig, brand);
    // Merge capabilities against the actual brand after applying environment defaults.
    effectiveBrand.features = { ...effectiveBrand.features, ...brand.features };
    const effective = mergeWebsiteConfig(effectiveBrand, mergeWebsiteConfig(buildLocationConfigFromEnv() as WebsiteConfig, local));
    return { brand, local, effective, revision: configRevision({ brand, local }) };
  }

  async transaction<T>(brandId: string, action: (tx: Prisma.TransactionClient) => Promise<T>) {
    const result = await this.prisma.$transaction(async (tx) => {
      const brand = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM Brand WHERE id = ${brandId} FOR UPDATE`;
      if (!brand.length) throw new NotFoundException('WEBSITE_NOT_FOUND');
      return action(tx);
    }, { timeout: 10_000 });
    // A provider outage never rolls back published content; the durable worker retries.
    void this.cleanup.flush(brandId).catch(() => this.logger.warn(`WEBSITE_MEDIA_CLEANUP_DEFERRED brand=${brandId}`));
    return result;
  }

  async enqueueRemoved(tx: Prisma.TransactionClient, brandId: string, before: WebsiteConfig, after: WebsiteConfig) {
    const next = new Set(landingImageReferences(after).map((entry) => entry.fileId));
    for (const entry of landingImageReferences(before)) {
      if (!entry.fileId || next.has(entry.fileId)) continue;
      await tx.websiteMediaDeletion.upsert({ where: { brandId_fileId: { brandId, fileId: entry.fileId } },
        create: { brandId, fileId: entry.fileId, url: entry.url }, update: { nextAttempt: new Date() } });
    }
  }

  async assertAvailable(tx: Prisma.TransactionClient, brandId: string, images: WebsiteImage[]) {
    const fileIds = images.map((entry) => entry.fileId).filter(Boolean);
    if (!fileIds.length) return;
    const removed = await tx.websiteMediaDeletion.findFirst({ where: { brandId, fileId: { in: fileIds }, status: { in: ['deleting', 'deleted'] } }, select: { id: true } });
    if (removed) throw new ConflictException('WEBSITE_MEDIA_REMOVED');
  }

  async savePlatform(brandId: string, localId: string | null, incoming: Record<string, unknown>) {
    // Resolve external media before acquiring the lock. The revision is checked again inside it.
    if (localId && !await this.prisma.location.findFirst({ where: { id: localId, brandId }, select: { id: true } })) throw new NotFoundException('WEBSITE_NOT_FOUND');
    const baseline = localId ? await this.prisma.locationConfig.findUnique({ where: { localId }, select: { data: true } })
      : await this.prisma.brandConfig.findUnique({ where: { brandId }, select: { data: true } });
    if (incoming._revision !== configRevision(baseline?.data ?? {})) throw new ConflictException('WEBSITE_CONFIG_CONFLICT');
    let prepared: Record<string, unknown>;
    try {
      prepared = await new PrepareLandingAppearanceUseCase(this.fonts).execute(brandId, localId, incoming, (baseline?.data ?? {}) as Record<string, unknown>);
    } catch (error) {
      if (error instanceof DomainError && error.code === 'LANDING_APPEARANCE_INVALID') throw new BadRequestException(error.code);
      if (error instanceof DomainError && error.code === 'LANDING_FONT_UNAVAILABLE') throw new ServiceUnavailableException(error.code);
      throw error;
    }
    return this.transaction(brandId, async (tx) => {
      if (localId && !await tx.location.findFirst({ where: { id: localId, brandId }, select: { id: true } })) throw new NotFoundException('WEBSITE_NOT_FOUND');
      const row = localId ? await tx.locationConfig.findUnique({ where: { localId }, select: { data: true } })
        : await tx.brandConfig.findUnique({ where: { brandId }, select: { data: true } });
      const previous = (row?.data ?? {}) as WebsiteConfig;
      if (incoming._revision !== configRevision(previous)) throw new ConflictException('WEBSITE_CONFIG_CONFLICT');
      const next = { ...prepared }; delete next._revision;
      await this.assertAvailable(tx, brandId, landingImageReferences(next));
      const data = next as Prisma.InputJsonValue;
      const saved = localId ? await tx.locationConfig.upsert({ where: { localId }, create: { localId, data }, update: { data } })
        : await tx.brandConfig.upsert({ where: { brandId }, create: { brandId, data }, update: { data } });
      await this.enqueueRemoved(tx, brandId, previous, next);
      return { ...saved, data: { ...next, _revision: configRevision(next) } };
    });
  }
}
