import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../../contexts/platform/ports/outbound/tenant-context.port';
import { BookingMaintenancePort } from '../../../contexts/booking/ports/outbound/booking-maintenance.port';
import {
  BookingStatusSideEffectsStatus,
  RunAppointmentStatusSideEffectsUseCase,
} from '../../../contexts/booking/application/use-cases/run-appointment-status-side-effects.use-case';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { mapAppointment } from '../appointments.mapper';
import { parseGuestContact } from '../../../shared/domain/guest-contact';

const DEFAULT_SERVICE_DURATION = 30;
const CONFIRMATION_GRACE_MS = 60 * 1000;
const ANONYMIZED_NAME = 'Invitado anonimizado';
const buildAnonymizedContact = (id: string) => `anonimo+${id.slice(0, 8)}@example.invalid`;

@Injectable()
export class ModuleBookingMaintenanceAdapter implements BookingMaintenancePort {
  private readonly logger = new Logger(ModuleBookingMaintenanceAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly notificationsService: NotificationsService,
    private readonly runAppointmentStatusSideEffectsUseCase: RunAppointmentStatusSideEffectsUseCase,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  private getLocalId() {
    return this.tenantContextPort.getRequestContext().localId;
  }

  private async runStatusSideEffects(appointmentId: string, nextStatus: AppointmentStatus) {
    const result = await this.runAppointmentStatusSideEffectsUseCase.execute({
      localId: this.getLocalId(),
      appointmentId,
      nextStatus: nextStatus as BookingStatusSideEffectsStatus,
    });

    result.failures.forEach((failure) => {
      this.logger.error(
        `Post-status side effect failed (${failure.effect}) for appointment ${appointmentId}: ${failure.message}`,
      );
    });
  }

  private async syncAppointmentStatuses(
    appointments: Array<{
      id: string;
      status: AppointmentStatus;
      startDateTime: Date;
      earlierSlotRequested?: boolean;
      service?: { duration?: number | null } | null;
    }>,
  ) {
    const now = new Date();
    const updates: Promise<unknown>[] = [];
    let updatedCount = 0;
    const completedIds: string[] = [];

    appointments.forEach((appointment) => {
      if (
        appointment.status === 'cancelled' ||
        appointment.status === 'completed' ||
        appointment.status === 'no_show'
      ) {
        return;
      }

      const duration = appointment.service?.duration ?? DEFAULT_SERVICE_DURATION;
      const endTime = new Date(appointment.startDateTime.getTime() + duration * 60 * 1000);
      const confirmationThreshold = new Date(endTime.getTime() + CONFIRMATION_GRACE_MS);
      const nextStatus = now >= confirmationThreshold ? 'completed' : 'scheduled';
      const shouldExpireEarlierSlotRequest =
        appointment.earlierSlotRequested === true && now >= appointment.startDateTime;

      if (appointment.status !== nextStatus || shouldExpireEarlierSlotRequest) {
        updatedCount += 1;
        if (appointment.status !== nextStatus && nextStatus === 'completed') {
          completedIds.push(appointment.id);
        }
        updates.push(
          this.prisma.appointment.update({
            where: { id: appointment.id },
            data: {
              status: appointment.status !== nextStatus ? nextStatus : undefined,
              earlierSlotRequested: shouldExpireEarlierSlotRequest ? false : undefined,
            },
          }),
        );
      }
    });

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    const BATCH_SIZE = 20;
    for (let index = 0; index < completedIds.length; index += BATCH_SIZE) {
      const batch = completedIds.slice(index, index + BATCH_SIZE);
      await Promise.all(batch.map((id) => this.runStatusSideEffects(id, 'completed')));
    }

    return updatedCount;
  }

  private getContact(
    user: any,
    guestName?: string | null,
    guestContact?: string | null,
    guestEmail?: string | null,
    guestPhone?: string | null,
  ) {
    const structuredGuestContact = parseGuestContact({ guestContact, guestEmail, guestPhone });
    return {
      email: user?.email || structuredGuestContact.email,
      phone: user?.phone || structuredGuestContact.phone,
      name: user?.name || guestName || null,
    };
  }

  syncStatusesForAllAppointments(): Promise<number> {
    const localId = this.getLocalId();
    return this.prisma.appointment
      .findMany({
        where: { status: { in: ['scheduled'] }, localId },
        include: { service: true },
      })
      .then((appointments) => this.syncAppointmentStatuses(appointments));
  }

  syncStatusesForAppointments(params: { appointmentIds: string[] }): Promise<number> {
    const uniqueIds = Array.from(new Set((params.appointmentIds || []).filter(Boolean)));
    if (uniqueIds.length === 0) {
      return Promise.resolve(0);
    }
    const localId = this.getLocalId();
    return this.prisma.appointment
      .findMany({
        where: {
          id: { in: uniqueIds },
          localId,
          status: { in: ['scheduled'] },
        },
        include: { service: true },
      })
      .then((appointments) => this.syncAppointmentStatuses(appointments));
  }

  async findAppointmentsForAnonymization(params: { localId: string; cutoff: Date }): Promise<string[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        localId: params.localId,
        anonymizedAt: null,
        startDateTime: { lt: params.cutoff },
        OR: [
          { guestName: { not: null } },
          { guestContact: { not: null } },
          { guestEmail: { not: null } },
          { guestPhone: { not: null } },
          { notes: { not: null } },
        ],
      },
      select: { id: true },
    });
    return appointments.map((appointment) => appointment.id);
  }

  async sendPaymentConfirmation(params: { appointmentId: string; localId: string }): Promise<void> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: params.appointmentId, localId: params.localId },
      include: { user: true, barber: true, service: true },
    });
    if (!appointment) return;

    const contact = this.getContact(
      appointment.user,
      appointment.guestName,
      appointment.guestContact,
      appointment.guestEmail,
      appointment.guestPhone,
    );
    const allowEmail = appointment.user ? appointment.user.notificationEmail !== false : true;
    if (!allowEmail) return;

    await this.notificationsService.sendAppointmentEmail(
      contact,
      {
        date: appointment.startDateTime,
        serviceName: appointment.service?.name,
        barberName: appointment.barber?.name,
      },
      'creada',
      {
        appointmentId: appointment.id,
        idempotencyKey: `appointment:${appointment.id}:created`,
      },
    );
  }

  async anonymizeAppointment(params: {
    appointmentId: string;
    actorUserId?: string | null;
    reason?: string;
  }): Promise<unknown> {
    const localId = this.getLocalId();
    const existing = await this.prisma.appointment.findFirst({
      where: { id: params.appointmentId, localId },
    });
    if (!existing) throw new NotFoundException('Appointment not found');

    const shouldRedactGuest = !existing.userId;
    const updated = await this.prisma.appointment.update({
      where: { id: params.appointmentId },
      data: {
        guestName: shouldRedactGuest ? ANONYMIZED_NAME : existing.guestName,
        guestContact: shouldRedactGuest ? buildAnonymizedContact(params.appointmentId) : existing.guestContact,
        guestEmail: shouldRedactGuest ? buildAnonymizedContact(params.appointmentId) : existing.guestEmail,
        guestPhone: shouldRedactGuest ? null : existing.guestPhone,
        notes: null,
        anonymizedAt: new Date(),
      },
    });

    await this.auditLogs.log({
      locationId: localId,
      actorUserId: params.actorUserId || null,
      action: 'appointment.anonymized',
      entityType: 'appointment',
      entityId: params.appointmentId,
      metadata: { reason: params.reason || 'manual' },
    });

    return mapAppointment(updated);
  }
}
