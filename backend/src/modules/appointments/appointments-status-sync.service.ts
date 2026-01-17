import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import { PrismaService } from '../../prisma/prisma.service';
import { runForEachActiveLocation } from '../../tenancy/tenant.utils';
import { AppointmentsService } from './appointments.service';

@Injectable()
export class AppointmentsStatusSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppointmentsStatusSyncService.name);
  private task: ScheduledTask | null = null;

  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly prisma: PrismaService,
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
    try {
      let updatedTotal = 0;
      await runForEachActiveLocation(this.prisma, async ({ brandId, localId }) => {
        try {
          const updated = await this.appointmentsService.syncStatusesForAllAppointments();
          updatedTotal += updated;
        } catch (error) {
          this.logger.error(
            `Appointment status sync failed for ${brandId}/${localId}.`,
            error instanceof Error ? error.stack : `${error}`,
          );
        }
      });
      if (updatedTotal > 0) {
        this.logger.log(`Appointment status sync: updated ${updatedTotal} appointments.`);
      }
    } catch (error) {
      this.logger.error(
        'Appointment status sync failed.',
        error instanceof Error ? error.stack : `${error}`,
      );
    }
  }
}
