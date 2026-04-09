import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import {
  ACTIVE_LOCATION_ITERATOR_PORT,
  ActiveLocationIteratorPort,
} from '../../contexts/platform/ports/outbound/active-location-iterator.port';
import {
  DISTRIBUTED_LOCK_PORT,
  DistributedLockPort,
} from '../../shared/application/distributed-lock.port';
import { runTenantScopedJob } from '../../shared/application/tenant-job-execution';
import { CommunicationsService } from './communications.service';

@Injectable()
export class CommunicationsSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommunicationsSchedulerService.name);
  private task: ScheduledTask | null = null;

  constructor(
    private readonly communicationsService: CommunicationsService,
    @Inject(ACTIVE_LOCATION_ITERATOR_PORT)
    private readonly activeLocationIteratorPort: ActiveLocationIteratorPort,
    @Inject(DISTRIBUTED_LOCK_PORT)
    private readonly distributedLockPort: DistributedLockPort,
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
    const executed = await this.distributedLockPort.runWithLock(
      'cron:communications-scheduled',
      async () => {
        await this.runScheduledForAllTenants();
      },
      {
        ttlMs: 2 * 60_000,
        onLockedMessage: 'Skipping communications scheduler in this instance; lock already held',
      },
    );
    if (!executed) return;
  }

  private async runScheduledForAllTenants() {
    await runTenantScopedJob({
      jobName: 'communications-scheduled',
      logger: this.logger,
      iterator: this.activeLocationIteratorPort,
      alertPolicy: {
        failureRateWarnThreshold: 0.05,
        failedLocationsWarnThreshold: 1,
      },
      executeForLocation: async () => {
        const result = await this.communicationsService.runScheduledDueCampaigns();
        return { processedCampaigns: result.processed };
      },
    });
  }
}
