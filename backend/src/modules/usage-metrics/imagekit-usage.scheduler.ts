import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { AI_TIME_ZONE } from '../ai-assistant/ai-assistant.utils';
import { UsageMetricsService } from './usage-metrics.service';

@Injectable()
export class ImageKitUsageScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImageKitUsageScheduler.name);
  private task: ScheduledTask | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    private readonly usageMetrics: UsageMetricsService,
  ) {}

  onModuleInit() {
    this.task = schedule(
      '30 0 * * *',
      () => {
        void this.captureUsageSnapshot();
      },
      { timezone: AI_TIME_ZONE },
    );
  }

  onModuleDestroy() {
    this.task?.stop();
  }

  private async captureUsageSnapshot() {
    const brands = await this.prisma.brand.findMany({ select: { id: true, name: true } });
    if (!brands.length) return;

    const usageCache = new Map<string, { used: number; limit: number | null }>();
    const recordedKeys = new Set<string>();

    for (const brand of brands) {
      const config = await this.tenantConfig.getBrandConfig(brand.id);
      const privateKey = config.imagekit?.privateKey;
      if (!privateKey) continue;

      if (recordedKeys.has(privateKey)) {
        continue;
      }
      let usage: { used: number; limit: number | null } | null | undefined = usageCache.get(privateKey);
      if (!usage) {
        usage = await this.fetchImageKitUsage(privateKey);
        if (usage) {
          usageCache.set(privateKey, usage);
        }
      }

      if (!usage) continue;
      await this.usageMetrics.recordImageKitUsage({
        brandId: brand.id,
        storageUsedBytes: usage.used,
        storageLimitBytes: usage.limit,
      });
      recordedKeys.add(privateKey);
    }
  }

  private async fetchImageKitUsage(privateKey: string) {
    try {
      const response = await fetch('https://api.imagekit.io/v1/usage', {
        headers: {
          Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}`,
        },
      });
      if (!response.ok) {
        const message = await response.text();
        this.logger.warn(`ImageKit usage error: ${message || response.statusText}`);
        return null;
      }
      const data = await response.json();
      const used = this.pickNumber(
        data?.storageUsed,
        data?.storageUsedBytes,
        data?.storage,
        data?.storage?.used,
        data?.storage?.total,
      );
      if (!Number.isFinite(used)) {
        this.logger.warn('ImageKit usage payload sin campo de almacenamiento reconocido.');
        return null;
      }
      const limit = this.pickNumber(
        data?.storageLimit,
        data?.storageLimitBytes,
        data?.storage?.limit,
        data?.storage?.max,
      );
      return { used, limit: Number.isFinite(limit) ? limit : null };
    } catch (error) {
      this.logger.warn('No se pudo consultar el uso de ImageKit.');
      return null;
    }
  }

  private pickNumber(...candidates: Array<number | string | null | undefined>) {
    for (const value of candidates) {
      if (value === null || value === undefined) continue;
      const parsed = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return NaN;
  }
}
