import { Inject, Injectable } from '@nestjs/common';
import {
  EngagementNotificationReminderPort,
  EngagementPendingReminder,
} from '../../../contexts/engagement/ports/outbound/notification-reminder.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../../contexts/platform/ports/outbound/tenant-context.port';
import { PrismaService } from '../../../prisma/prisma.service';
import { parseGuestContact } from '../../../shared/domain/guest-contact';
import { GuestAppointmentLinkService } from '../../guest-appointment-access/guest-appointment-link.service';

@Injectable()
export class PrismaEngagementNotificationReminderAdapter implements EngagementNotificationReminderPort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
    private readonly guestAppointmentLinkService: GuestAppointmentLinkService,
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
        serviceItems: { orderBy: { position: 'asc' } },
        local: {
          select: {
            brand: { select: { customDomain: true, subdomain: true } },
          },
        },
      },
    });

    return appointments.map((appointment) => {
      const structuredGuestContact = parseGuestContact(appointment);
      const emailCandidate = appointment.user?.email || structuredGuestContact.email;
      const phoneCandidate = appointment.user?.phone || structuredGuestContact.phone;
      const allowSms = appointment.user
        ? appointment.user.notificationSms === true
        : appointment.reminderSmsRequested === true;
      const allowWhatsapp = appointment.user
        ? appointment.user.notificationWhatsapp === true
        : appointment.reminderWhatsappRequested === true;
      const managementUrl = !appointment.user && (allowSms || allowWhatsapp)
        ? this.guestAppointmentLinkService.createManagementUrlForGuestAppointment({
            appointmentId: appointment.id,
            startDateTime: appointment.startDateTime,
            customDomain: appointment.local.brand.customDomain,
            subdomain: appointment.local.brand.subdomain,
          })
        : null;

      return {
        appointmentId: appointment.id,
        reminderRevision: appointment.updatedAt.toISOString(),
        allowSms,
        allowWhatsapp,
        contact: {
          email: emailCandidate || null,
          phone: phoneCandidate || null,
          name: appointment.user?.name || appointment.guestName || null,
        },
        appointment: {
          date: appointment.startDateTime,
          serviceName: appointment.serviceNameSnapshot
            || appointment.serviceItems.map((item) => item.nameSnapshot).join(' + ')
            || appointment.service?.name,
          barberName: appointment.barber?.name,
          managementUrl: managementUrl || undefined,
        },
      };
    });
  }

  async markReminderSent(appointmentId: string): Promise<void> {
    const localId = this.tenantContextPort.getRequestContext().localId;
    await this.prisma.appointment.updateMany({
      where: { id: appointmentId, localId },
      data: { reminderSent: true },
    });
  }
}
