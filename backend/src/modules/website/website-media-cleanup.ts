import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, WebsiteMediaDeletion } from '@prisma/client';
import { schedule, ScheduledTask } from 'node-cron';
import { PrismaService } from '../../prisma/prisma.service';
import { ImagekitWebsiteMediaAdapter } from './imagekit-website-media.adapter';

// A boolean-only global reference check is intentional: the same legacy file may be shared
// by several brands. No business data leaves this maintenance adapter.
export async function isWebsiteMediaReferenced(tx: Prisma.TransactionClient, fileId: string, url: string): Promise<boolean> {
  const escapedUrl = url.replace(/[\\%_]/g, '\\$&') + '%';
  const rows = await tx.$queryRaw<Array<{ found: number | bigint }>>`
    SELECT (
      EXISTS(SELECT 1 FROM BrandConfig WHERE JSON_SEARCH(data, 'one', ${fileId}) IS NOT NULL OR JSON_SEARCH(data, 'one', ${escapedUrl}) IS NOT NULL)
      OR EXISTS(SELECT 1 FROM LocationConfig WHERE JSON_SEARCH(data, 'one', ${fileId}) IS NOT NULL OR JSON_SEARCH(data, 'one', ${escapedUrl}) IS NOT NULL)
      OR EXISTS(SELECT 1 FROM SiteSettings WHERE JSON_SEARCH(data, 'one', ${fileId}) IS NOT NULL OR JSON_SEARCH(data, 'one', ${escapedUrl}) IS NOT NULL)
      OR EXISTS(SELECT 1 FROM Product WHERE imageFileId = ${fileId} OR imageUrl = ${url})
      OR EXISTS(SELECT 1 FROM Barber WHERE photoFileId = ${fileId} OR photo = ${url})
      OR EXISTS(SELECT 1 FROM GalleryItem WHERE imageFileId = ${fileId} OR beforeFileId = ${fileId} OR imageUrl = ${url} OR beforeUrl = ${url})
      OR EXISTS(SELECT 1 FROM Invoice WHERE logoUrl = ${url})
    ) AS found`;
  return Number(rows[0]?.found) === 1;
}

@Injectable()
export class WebsiteMediaCleanup implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebsiteMediaCleanup.name);
  private task: ScheduledTask | null = null;
  private running = false;
  constructor(private readonly prisma: PrismaService, private readonly media: ImagekitWebsiteMediaAdapter) {}
  onModuleInit() { this.task = schedule('* * * * *', () => { void this.flush().catch(() => this.logger.warn('WEBSITE_MEDIA_CLEANUP_FAILED')); }); }
  onModuleDestroy() { this.task?.stop(); }

  async flush(brandId?: string) {
    if (this.running) return;
    this.running = true;
    try {
      // tenant-scope-ignore: internal retry worker; bounded cross-brand batch, never an HTTP projection.
      const jobs = await this.prisma.websiteMediaDeletion.findMany({ where: { ...(brandId ? { brandId } : {}), status: { in: ['pending', 'deleting'] }, nextAttempt: { lte: new Date() } }, orderBy: { nextAttempt: 'asc' }, take: 20 });
      for (const job of jobs) await this.process(job);
    } finally { this.running = false; }
  }

  private async process(job: WebsiteMediaDeletion) {
    const claimed = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Brand WHERE id = ${job.brandId} FOR UPDATE`;
      const current = await tx.websiteMediaDeletion.findFirst({ where: { id: job.id, brandId: job.brandId } });
      if (!current || current.status === 'deleted' || current.nextAttempt > new Date()) return false;
      if (await isWebsiteMediaReferenced(tx, job.fileId, job.url)) {
        await tx.websiteMediaDeletion.update({ where: { id: job.id, brandId: job.brandId }, data: { status: 'pending', nextAttempt: new Date(Date.now() + 86_400_000) } });
        return false;
      }
      await tx.websiteMediaDeletion.update({ where: { id: job.id, brandId: job.brandId }, data: { status: 'deleting', nextAttempt: new Date(Date.now() + 120_000), attempts: { increment: 1 } } });
      return true;
    });
    if (!claimed) return;
    try {
      await this.media.remove(job.brandId, job.fileId);
      await this.prisma.websiteMediaDeletion.update({ where: { id: job.id, brandId: job.brandId }, data: { status: 'deleted' } });
    } catch {
      this.logger.warn(`WEBSITE_MEDIA_DELETE_RETRY brand=${job.brandId} job=${job.id}`);
      await this.prisma.websiteMediaDeletion.update({ where: { id: job.id, brandId: job.brandId }, data: { status: 'deleting', nextAttempt: new Date(Date.now() + Math.min(86_400_000, 60_000 * 2 ** Math.min(job.attempts, 10))) } });
    }
  }
}
