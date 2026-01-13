import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import { AppointmentsService } from './appointments.service';

@Injectable()
export class AppointmentsStatusSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppointmentsStatusSyncService.name);
  private task: ScheduledTask | null = null;

  constructor(private readonly appointmentsService: AppointmentsService) {}

  onModuleInit() {
    this.task = schedule('*/5 * * * *', () => {
      void this.handleSync();
    });
  }

  onModuleDestroy() {
    this.task?.stop();
  }

  private async handleSync() {
    try {
      const updated = await this.appointmentsService.syncStatusesForAllAppointments();
      if (updated > 0) {
        this.logger.log(`Appointment status sync: updated ${updated} appointments.`);
      }
    } catch (error) {
      this.logger.error(
        'Appointment status sync failed.',
        error instanceof Error ? error.stack : `${error}`,
      );
    }
  }
}
