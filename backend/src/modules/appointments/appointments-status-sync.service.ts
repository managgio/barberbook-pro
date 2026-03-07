import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import {
  ACTIVE_LOCATION_ITERATOR_PORT,
  ActiveLocationIteratorPort,
} from '../../contexts/platform/ports/outbound/active-location-iterator.port';
import { DISTRIBUTED_LOCK_PORT, DistributedLockPort } from '../../shared/application/distributed-lock.port';
import { runTenantScopedJob } from '../../shared/application/tenant-job-execution';
import { SyncAppointmentStatusesUseCase } from '../../contexts/booking/application/use-cases/sync-appointment-statuses.use-case';

@Injectable()
export class AppointmentsStatusSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppointmentsStatusSyncService.name);
  private task: ScheduledTask | null = null;

  constructor(
    private readonly syncAppointmentStatusesUseCase: SyncAppointmentStatusesUseCase,
    @Inject(DISTRIBUTED_LOCK_PORT)
    private readonly distributedLockPort: DistributedLockPort,
    @Inject(ACTIVE_LOCATION_ITERATOR_PORT)
    private readonly activeLocationIteratorPort: ActiveLocationIteratorPort,
  ) {}

  onModuleInit() {
    this.task = schedule('*/5 * * * *', () => {
      void this.handleSync();
    });
  }

  onModuleDestroy() {
    this.task?.stop();
  }

  private async handleSync() {
    const executed = await this.distributedLockPort.runWithLock(
      'cron:appointments-status-sync',
      async () => {
        await this.runSync();
      },
      {
        ttlMs: 8 * 60_000,
        onLockedMessage: 'Skipping status sync in this instance; lock already held',
      },
    );
    if (!executed) return;
  }

  private async runSync() {
    await runTenantScopedJob({
      jobName: 'appointments-status-sync',
      logger: this.logger,
      iterator: this.activeLocationIteratorPort,
      alertPolicy: {
        failureRateWarnThreshold: 0.05,
        failedLocationsWarnThreshold: 1,
      },
      executeForLocation: async () => {
        const updated = await this.syncAppointmentStatusesUseCase.execute();
        return { appointmentsUpdated: updated };
      },
    });
  }
}
