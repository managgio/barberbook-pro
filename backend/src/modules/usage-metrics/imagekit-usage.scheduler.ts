import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import { DistributedLockService } from '../../prisma/distributed-lock.service';
import { AI_TIME_ZONE } from '../ai-assistant/ai-assistant.utils';
import { UsageMetricsService } from './usage-metrics.service';

@Injectable()
export class ImageKitUsageScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImageKitUsageScheduler.name);
  private task: ScheduledTask | null = null;

  constructor(
    private readonly usageMetrics: UsageMetricsService,
    private readonly distributedLock: DistributedLockService,
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
    await this.distributedLock.runWithLock(
      'cron:usage-metrics-imagekit',
      async () => {
        await this.usageMetrics.refreshImageKitUsage();
      },
      {
        ttlMs: 20 * 60_000,
        onLockedMessage: 'Skipping ImageKit usage snapshot in this instance; lock already held',
      },
    );
  }
}
