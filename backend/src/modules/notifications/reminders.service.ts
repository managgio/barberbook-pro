import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import { DistributedLockService } from '../../prisma/distributed-lock.service';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { runForEachActiveLocation } from '../../tenancy/tenant.utils';
import { NotificationsService } from './notifications.service';
import { TenantConfigService } from '../../tenancy/tenant-config.service';

const REMINDER_OFFSET_MS = 24 * 60 * 60 * 1000; // 24h
const REMINDER_WINDOW_MS = 10 * 60 * 1000; // 10 minutes window to avoid repeats if job runs often

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private task: ScheduledTask | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly tenantConfig: TenantConfigService,
    private readonly distributedLock: DistributedLockService,
  ) {}

  onModuleInit() {
    // Every 5 minutes
    this.task = schedule('*/5 * * * *', () => this.handleReminders());
  }

  onModuleDestroy() {
    this.task?.stop();
  }

  private async handleReminders() {
    const executed = await this.distributedLock.runWithLock(
      'cron:notifications-reminders',
      async () => {
        await this.runReminders();
      },
      {
        ttlMs: 10 * 60_000,
        onLockedMessage: 'Skipping reminders in this instance; lock already held',
      },
    );
    if (!executed) return;
  }

  private async runReminders() {
    let totalReminders = 0;
    await runForEachActiveLocation(this.prisma, async ({ brandId, localId }) => {
      try {
        const sent = await this.handleRemindersForLocal();
        totalReminders += sent;
      } catch (error) {
        this.logger.error(
          `Reminder job failed for ${brandId}/${localId}.`,
          error instanceof Error ? error.stack : `${error}`,
        );
      }
    });

    if (totalReminders > 0) {
      this.logger.log(`Reminder job: sent ${totalReminders} reminders`);
    }
  }

  private async handleRemindersForLocal() {
    const config = await this.tenantConfig.getEffectiveConfig();
    const smsEnabled = config.notificationPrefs?.sms !== false;
    const whatsappEnabled = config.notificationPrefs?.whatsapp !== false;
    if (!smsEnabled && !whatsappEnabled) {
      return 0;
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() + REMINDER_OFFSET_MS - REMINDER_WINDOW_MS);
    const windowEnd = new Date(now.getTime() + REMINDER_OFFSET_MS + REMINDER_WINDOW_MS);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        localId: getCurrentLocalId(),
        status: 'scheduled',
        reminderSent: false,
        startDateTime: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
      include: {
        user: true,
        barber: true,
        service: true,
      },
    });

    let sentCount = 0;
    for (const appointment of appointments) {
      const allowSms = appointment.user ? appointment.user.notificationSms === true : false;
      const allowWhatsapp = appointment.user ? appointment.user.notificationWhatsapp === true : false;
      if (!allowSms && !allowWhatsapp) {
        continue;
      }

      const contact = this.getContact(appointment.user, appointment.guestName, appointment.guestContact);
      const payload = {
        date: appointment.startDateTime,
        serviceName: appointment.service?.name,
        barberName: appointment.barber?.name,
      };
      if (smsEnabled && allowSms) {
        await this.notificationsService.sendReminderSms(contact, payload);
      }
      if (whatsappEnabled && allowWhatsapp) {
        await this.notificationsService.sendReminderWhatsapp(contact, payload);
      }

      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: { reminderSent: true },
      });
      sentCount += 1;
    }

    return sentCount;
  }

  private getContact(user: any, guestName?: string | null, guestContact?: string | null) {
    const emailCandidate = user?.email || (guestContact?.includes('@') ? guestContact : null);
    const phoneCandidate = user?.phone || (!guestContact?.includes('@') ? guestContact : null);
    return {
      email: emailCandidate || null,
      phone: phoneCandidate || null,
      name: user?.name || guestName || null,
    };
  }
}
