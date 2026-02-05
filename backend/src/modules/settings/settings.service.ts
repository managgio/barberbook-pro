import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { SiteSettings, normalizeSettings, cloneSettings } from './settings.types';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  private async resolveRuntimeFlags() {
    const config = await this.tenantConfig.getEffectiveConfig();
    const hidden = config.adminSidebar?.hiddenSections;
    const productsEnabled = !Array.isArray(hidden) || !hidden.includes('stock');
    const barberServiceAssignmentPlatformEnabled =
      config.features?.barberServiceAssignmentEnabled !== false;
    return {
      productsEnabled,
      barberServiceAssignmentPlatformEnabled,
    };
  }

  private async ensureSettings(): Promise<SiteSettings> {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.siteSettings.findUnique({ where: { localId } });
    if (!existing) {
      const shopSchedule = await this.prisma.shopSchedule.findUnique({ where: { localId } });
      const defaults = normalizeSettings({
        openingHours: (shopSchedule?.data || undefined) as SiteSettings['openingHours'] | undefined,
      });
      await this.prisma.siteSettings.create({ data: { localId, data: defaults } });
      return defaults;
    }
    return normalizeSettings(existing.data as Partial<SiteSettings>);
  }

  async getSettings(): Promise<SiteSettings> {
    const [settings, runtimeFlags] = await Promise.all([
      this.ensureSettings(),
      this.resolveRuntimeFlags(),
    ]);
    return cloneSettings({
      ...settings,
      services: {
        ...settings.services,
        barberServiceAssignmentEnabled:
          runtimeFlags.barberServiceAssignmentPlatformEnabled
            ? settings.services.barberServiceAssignmentEnabled
            : false,
      },
      products: { ...settings.products, enabled: runtimeFlags.productsEnabled },
    });
  }

  async updateSettings(settings: SiteSettings): Promise<SiteSettings> {
    const localId = getCurrentLocalId();
    const normalized = normalizeSettings(settings);
    const runtimeFlags = await this.resolveRuntimeFlags();
    normalized.products.enabled = runtimeFlags.productsEnabled;

    if (!runtimeFlags.barberServiceAssignmentPlatformEnabled) {
      const existing = await this.prisma.siteSettings.findUnique({
        where: { localId },
        select: { data: true },
      });
      const existingNormalized = normalizeSettings(
        (existing?.data || undefined) as Partial<SiteSettings> | undefined,
      );
      normalized.services.barberServiceAssignmentEnabled =
        existingNormalized.services.barberServiceAssignmentEnabled;
    }

    if (normalized.products.categoriesEnabled) {
      const uncategorizedProducts = await this.prisma.product.count({
        where: { categoryId: null, localId },
      });
      if (uncategorizedProducts > 0) {
        throw new BadRequestException(
          'Asigna una categoría a todos los productos antes de activar la categorización.',
        );
      }
    }

    await this.prisma.siteSettings.upsert({
      where: { localId },
      update: { data: normalized },
      create: { localId, data: normalized },
    });
    await this.prisma.shopSchedule.upsert({
      where: { localId },
      update: { data: normalized.openingHours },
      create: { localId, data: normalized.openingHours },
    });
    return this.getSettings();
  }
}
