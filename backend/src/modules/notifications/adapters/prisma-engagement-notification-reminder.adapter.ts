import { Inject, Injectable } from '@nestjs/common';
import {
  EngagementNotificationReminderPort,
  EngagementPendingReminder,
} from '../../../contexts/engagement/ports/outbound/notification-reminder.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../../contexts/platform/ports/outbound/tenant-context.port';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PrismaEngagementNotificationReminderAdapter implements EngagementNotificationReminderPort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  async findPendingReminders(params: { windowStart: Date; windowEnd: Date }): Promise<EngagementPendingReminder[]> {
    const localId = this.tenantContextPort.getRequestContext().localId;
    const appointments = await this.prisma.appointment.findMany({
      where: {
        localId,
        status: 'scheduled',
        reminderSent: false,
        startDateTime: {
          gte: params.windowStart,
          lte: params.windowEnd,
        },
      },
      include: {
        user: true,
        barber: true,
        service: true,
      },
    });

    return appointments.map((appointment) => {
      const emailCandidate =
        appointment.user?.email ||
        (appointment.guestContact && appointment.guestContact.includes('@') ? appointment.guestContact : null);
      const phoneCandidate =
        appointment.user?.phone ||
        (appointment.guestContact && !appointment.guestContact.includes('@') ? appointment.guestContact : null);

      return {
        appointmentId: appointment.id,
        allowSms: appointment.user ? appointment.user.notificationSms === true : false,
        allowWhatsapp: appointment.user ? appointment.user.notificationWhatsapp === true : false,
        contact: {
          email: emailCandidate || null,
          phone: phoneCandidate || null,
          name: appointment.user?.name || appointment.guestName || null,
        },
        appointment: {
          date: appointment.startDateTime,
          serviceName: appointment.service?.name,
          barberName: appointment.barber?.name,
        },
      };
    });
  }

  async markReminderSent(appointmentId: string): Promise<void> {
    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { reminderSent: true },
    });
  }
}
