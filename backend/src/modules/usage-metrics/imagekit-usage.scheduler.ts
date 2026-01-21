import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import { AI_TIME_ZONE } from '../ai-assistant/ai-assistant.utils';
import { UsageMetricsService } from './usage-metrics.service';

@Injectable()
export class ImageKitUsageScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImageKitUsageScheduler.name);
  private task: ScheduledTask | null = null;

  constructor(
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
    await this.usageMetrics.refreshImageKitUsage();
  }
}
