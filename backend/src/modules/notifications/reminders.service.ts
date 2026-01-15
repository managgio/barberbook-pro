import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { NotificationsService } from './notifications.service';

const REMINDER_OFFSET_MS = 24 * 60 * 60 * 1000; // 24h
const REMINDER_WINDOW_MS = 10 * 60 * 1000; // 10 minutes window to avoid repeats if job runs often

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private task: ScheduledTask | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    // Every 5 minutes
    this.task = schedule('*/5 * * * *', () => this.handleReminders());
  }

  onModuleDestroy() {
    this.task?.stop();
  }

  private async handleReminders() {
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

    for (const appointment of appointments) {
      const allowSms = appointment.user ? appointment.user.notificationWhatsapp === true : false;
      if (!allowSms) {
        continue;
      }

      const contact = this.getContact(appointment.user, appointment.guestName, appointment.guestContact);
      await this.notificationsService.sendReminderSms(contact, {
        date: appointment.startDateTime,
        serviceName: appointment.service?.name,
        barberName: appointment.barber?.name,
      });

      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: { reminderSent: true },
      });
    }

    if (appointments.length > 0) {
      this.logger.log(`Reminder job: sent ${appointments.length} reminders`);
    }
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
