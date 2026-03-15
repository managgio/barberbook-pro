import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import { DistributedLockService } from '../../prisma/distributed-lock.service';
import { LocalizationService } from './localization.service';

@Injectable()
export class LocalizationSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LocalizationSchedulerService.name);
  private task: ScheduledTask | null = null;

  constructor(
    private readonly distributedLock: DistributedLockService,
    private readonly localizationService: LocalizationService,
  ) {}

  onModuleInit() {
    this.task = schedule('*/1 * * * *', () => {
      void this.handleTick();
    });
  }

  onModuleDestroy() {
    this.task?.stop();
  }

  private async handleTick() {
    const executed = await this.distributedLock.runWithLock(
      'cron:localization-translation',
      async () => {
        const result = await this.localizationService.processPendingTranslations(40);
        if (result.picked > 0) {
          this.logger.log(
            `Processed pending translations picked=${result.picked} processed=${result.processed} failed=${result.failed}`,
          );
        }
      },
      {
        ttlMs: 4 * 60_000,
        onLockedMessage: 'Skipping localization cron in this instance; lock already held',
      },
    );

    if (!executed) return;
  }
}
