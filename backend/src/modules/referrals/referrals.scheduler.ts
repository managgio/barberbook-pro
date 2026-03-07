import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import { RunReferralDailyMaintenanceUseCase } from '../../contexts/engagement/application/use-cases/run-referral-daily-maintenance.use-case';
import {
  ENGAGEMENT_REFERRAL_MAINTENANCE_PORT,
  EngagementReferralMaintenancePort,
} from '../../contexts/engagement/ports/outbound/referral-maintenance.port';
import {
  ACTIVE_LOCATION_ITERATOR_PORT,
  ActiveLocationIteratorPort,
} from '../../contexts/platform/ports/outbound/active-location-iterator.port';
import { DistributedLockService } from '../../prisma/distributed-lock.service';
import { runTenantScopedJob } from '../../shared/application/tenant-job-execution';

@Injectable()
export class ReferralsSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReferralsSchedulerService.name);
  private task: ScheduledTask | null = null;
  private readonly runReferralDailyMaintenanceUseCase: RunReferralDailyMaintenanceUseCase;

  constructor(
    private readonly distributedLock: DistributedLockService,
    @Inject(ACTIVE_LOCATION_ITERATOR_PORT)
    private readonly activeLocationIteratorPort: ActiveLocationIteratorPort,
    @Inject(ENGAGEMENT_REFERRAL_MAINTENANCE_PORT)
    private readonly referralMaintenancePort: EngagementReferralMaintenancePort,
  ) {
    this.runReferralDailyMaintenanceUseCase = new RunReferralDailyMaintenanceUseCase(this.referralMaintenancePort);
  }

  onModuleInit() {
    this.task = schedule('0 3 * * *', () => {
      void this.handleDaily();
    });
  }

  onModuleDestroy() {
    this.task?.stop();
  }

  private async handleDaily() {
    const executed = await this.distributedLock.runWithLock(
      'cron:referrals-daily',
      async () => {
        await this.runDaily();
      },
      {
        ttlMs: 45 * 60_000,
        onLockedMessage: 'Skipping referrals daily job in this instance; lock already held',
      },
    );
    if (!executed) return;
  }

  private async runDaily() {
    await runTenantScopedJob({
      jobName: 'referrals-daily',
      logger: this.logger,
      iterator: this.activeLocationIteratorPort,
      alertPolicy: {
        failureRateWarnThreshold: 0.05,
        failedLocationsWarnThreshold: 1,
      },
      executeForLocation: async () => this.runReferralDailyMaintenanceUseCase.execute(),
    });
  }
}
