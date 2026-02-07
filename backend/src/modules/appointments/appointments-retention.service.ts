import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import { DistributedLockService } from '../../prisma/distributed-lock.service';
import { PrismaService } from '../../prisma/prisma.service';
import { runForEachActiveLocation } from '../../tenancy/tenant.utils';
import { AI_TIME_ZONE } from '../ai-assistant/ai-assistant.utils';
import { LegalService } from '../legal/legal.service';
import { AppointmentsService } from './appointments.service';

@Injectable()
export class AppointmentsRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppointmentsRetentionService.name);
  private task: ScheduledTask | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly legalService: LegalService,
    private readonly appointmentsService: AppointmentsService,
    private readonly distributedLock: DistributedLockService,
  ) {}

  onModuleInit() {
    this.task = schedule(
      '30 2 * * *',
      () => {
        void this.handleRetention();
      },
      { timezone: AI_TIME_ZONE },
    );
  }

  onModuleDestroy() {
    this.task?.stop();
  }

  private async handleRetention() {
    const executed = await this.distributedLock.runWithLock(
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
    let anonymizedTotal = 0;
    await runForEachActiveLocation(this.prisma, async ({ brandId, localId }) => {
      try {
        const settings = await this.legalService.getSettings(brandId, localId);
        if (!settings.retentionDays) return;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - settings.retentionDays);

        const appointments = await this.prisma.appointment.findMany({
          where: {
            localId,
            anonymizedAt: null,
            startDateTime: { lt: cutoff },
            OR: [
              { guestName: { not: null } },
              { guestContact: { not: null } },
              { notes: { not: null } },
            ],
          },
          select: { id: true },
        });

        for (const appointment of appointments) {
          await this.appointmentsService.anonymizeAppointment(appointment.id, null, 'retention');
          anonymizedTotal += 1;
        }
      } catch (error) {
        this.logger.error(
          `Retention job failed for ${brandId}/${localId}.`,
          error instanceof Error ? error.stack : `${error}`,
        );
      }
    });

    if (anonymizedTotal > 0) {
      this.logger.log(`Retention job: anonymized ${anonymizedTotal} appointments.`);
    }
  }
}
