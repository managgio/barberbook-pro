import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import {
  ACTIVE_LOCATION_ITERATOR_PORT,
  ActiveLocationIteratorPort,
} from '../../contexts/platform/ports/outbound/active-location-iterator.port';
import {
  PLATFORM_LEGAL_MANAGEMENT_PORT,
  PlatformLegalManagementPort,
} from '../../contexts/platform/ports/outbound/platform-legal-management.port';
import { DISTRIBUTED_LOCK_PORT, DistributedLockPort } from '../../shared/application/distributed-lock.port';
import { runTenantScopedJob } from '../../shared/application/tenant-job-execution';
import { AnonymizeAppointmentUseCase } from '../../contexts/booking/application/use-cases/anonymize-appointment.use-case';
import { BOOKING_MAINTENANCE_PORT, BookingMaintenancePort } from '../../contexts/booking/ports/outbound/booking-maintenance.port';

const APPOINTMENTS_RETENTION_TIME_ZONE = 'Europe/Madrid';

@Injectable()
export class AppointmentsRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppointmentsRetentionService.name);
  private task: ScheduledTask | null = null;

  constructor(
    @Inject(PLATFORM_LEGAL_MANAGEMENT_PORT)
    private readonly legalManagementPort: PlatformLegalManagementPort,
    private readonly anonymizeAppointmentUseCase: AnonymizeAppointmentUseCase,
    @Inject(DISTRIBUTED_LOCK_PORT)
    private readonly distributedLockPort: DistributedLockPort,
    @Inject(BOOKING_MAINTENANCE_PORT)
    private readonly bookingMaintenancePort: BookingMaintenancePort,
    @Inject(ACTIVE_LOCATION_ITERATOR_PORT)
    private readonly activeLocationIteratorPort: ActiveLocationIteratorPort,
  ) {}

  onModuleInit() {
    this.task = schedule(
      '30 2 * * *',
      () => {
        void this.handleRetention();
      },
      { timezone: APPOINTMENTS_RETENTION_TIME_ZONE },
    );
  }

  onModuleDestroy() {
    this.task?.stop();
  }

  private async handleRetention() {
    const executed = await this.distributedLockPort.runWithLock(
      'cron:appointments-retention',
      async () => {
        await this.runRetention();
      },
      {
        ttlMs: 90 * 60_000,
        onLockedMessage: 'Skipping retention job in this instance; lock already held',
      },
    );
    if (!executed) return;
  }

  private async runRetention() {
    await runTenantScopedJob({
      jobName: 'appointments-retention',
      logger: this.logger,
      iterator: this.activeLocationIteratorPort,
      alertPolicy: {
        failureRateWarnThreshold: 0.05,
        failedLocationsWarnThreshold: 1,
      },
      executeForLocation: async ({ brandId, localId }) => {
        const settings = await this.legalManagementPort.getSettings(brandId, localId);
        if (!settings.retentionDays) return { appointmentsAnonymized: 0 };
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - settings.retentionDays);

        const appointmentIds = this.bookingMaintenancePort.findAppointmentsForAnonymization
          ? await this.bookingMaintenancePort.findAppointmentsForAnonymization({ localId, cutoff })
          : [];

        for (const appointmentId of appointmentIds) {
          await this.anonymizeAppointmentUseCase.execute({
            context: {
              tenantId: brandId,
              brandId,
              localId,
              actorUserId: null,
              timezone: APPOINTMENTS_RETENTION_TIME_ZONE,
              correlationId: `retention:${localId}:${appointmentId}`,
            },
            appointmentId,
            actorUserId: null,
            reason: 'retention',
          });
        }

        return { appointmentsAnonymized: appointmentIds.length };
      },
    });
  }
}
