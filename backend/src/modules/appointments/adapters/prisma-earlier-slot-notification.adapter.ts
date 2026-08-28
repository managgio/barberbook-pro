import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { formatDateInTimeZone } from '../../../utils/timezone';
import { GetAvailabilityUseCase } from '../../../contexts/booking/application/use-cases/get-availability.use-case';
import { NotifyEarlierSlotOpportunityCommand } from '../../../contexts/booking/application/commands/notify-earlier-slot-opportunity.command';
import { EarlierSlotNotificationPort } from '../../../contexts/booking/ports/outbound/earlier-slot-notification.port';
import { findFirstEarlierSlot } from '../../../contexts/booking/domain/services/earlier-slot-opportunity.policy';
import { NotificationsService } from '../../notifications/notifications.service';
import { SettingsService } from '../../settings/settings.service';
import { CLOCK_PORT, ClockPort } from '../../../shared/application/clock.port';

const CANDIDATE_BATCH_SIZE = 50;

const parseGuestEmail = (contact?: string | null) =>
  contact
    ?.split('·')
    .map((value) => value.trim())
    .find((value) => value.includes('@')) || null;

@Injectable()
export class PrismaEarlierSlotNotificationAdapter implements EarlierSlotNotificationPort {
  private readonly logger = new Logger(PrismaEarlierSlotNotificationAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly getAvailabilityUseCase: GetAvailabilityUseCase,
    private readonly notificationsService: NotificationsService,
    private readonly settingsService: SettingsService,
    @Inject(CLOCK_PORT)
    private readonly clockPort: ClockPort,
  ) {}

  async notifyFirstEligibleRequest(command: NotifyEarlierSlotOpportunityCommand): Promise<boolean> {
    const now = this.clockPort.now();
    const candidates = await this.prisma.appointment.findMany({
      where: {
        localId: command.context.localId,
        barberId: command.barberId,
        id: { not: command.releasedAppointmentId },
        status: 'scheduled',
        paymentStatus: { notIn: ['pending', 'failed', 'cancelled'] },
        earlierSlotRequested: true,
        earlierSlotNotifiedAt: null,
        startDateTime: { gt: command.releasedStartDateTime },
      },
      orderBy: { createdAt: 'asc' },
      take: CANDIDATE_BATCH_SIZE,
      include: {
        user: { select: { name: true, email: true } },
      },
    });
    if (candidates.length === 0) return false;

    const dateOnly = formatDateInTimeZone(
      command.releasedStartDateTime,
      command.context.timezone,
    );
    const settings = await this.settingsService.getSettings();
    const slotIntervalMinutes = settings.appointments?.slotIntervalMinutes === 30 ? 30 : 15;
    const slotsByService = new Map<string, string[]>();

    for (const candidate of candidates) {
      const email = candidate.user?.email || parseGuestEmail(candidate.guestContact);
      if (!email) continue;

      let availableSlots = slotsByService.get(candidate.serviceId);
      if (!availableSlots) {
        availableSlots = await this.getAvailabilityUseCase.execute({
          context: command.context,
          barberId: command.barberId,
          date: dateOnly,
          serviceId: candidate.serviceId,
          slotIntervalMinutes,
        });
        slotsByService.set(candidate.serviceId, availableSlots);
      }

      const availableStart = findFirstEarlierSlot({
        dateOnly,
        availableSlots,
        now,
        opportunityStart: command.releasedStartDateTime,
        appointmentStart: candidate.startDateTime,
        timezone: command.context.timezone,
      });
      if (!availableStart) continue;

      const claimedAt = this.clockPort.now();
      const claim = await this.prisma.appointment.updateMany({
        where: {
          id: candidate.id,
          localId: command.context.localId,
          status: 'scheduled',
          earlierSlotRequested: true,
          earlierSlotNotifiedAt: null,
          startDateTime: { gt: availableStart },
        },
        data: {
          earlierSlotNotifiedAt: claimedAt,
          earlierSlotCandidateAt: availableStart,
        },
      });
      if (claim.count !== 1) continue;

      try {
        const formattedSlot = new Intl.DateTimeFormat('es-ES', {
          timeZone: command.context.timezone,
          dateStyle: 'full',
          timeStyle: 'short',
        }).format(availableStart);
        await this.notificationsService.sendBroadcastEmail({
          contact: {
            email,
            name: candidate.user?.name || candidate.guestName || null,
          },
          subject: 'Se ha quedado un hueco libre antes de tu cita',
          message: [
            `Hay una cita disponible el ${formattedSlot}.`,
            'Es compatible con el servicio de tu reserva actual.',
            'Si quieres adelantarla, entra en la web o contacta con el establecimiento cuanto antes. El hueco no queda reservado automáticamente.',
          ].join('\n\n'),
        });
        return true;
      } catch (error) {
        await this.prisma.appointment.updateMany({
          where: {
            id: candidate.id,
            localId: command.context.localId,
            earlierSlotNotifiedAt: claimedAt,
            earlierSlotCandidateAt: availableStart,
          },
          data: {
            earlierSlotNotifiedAt: null,
            earlierSlotCandidateAt: null,
          },
        });
        this.logger.error(
          `Earlier-slot notification failed for appointment ${candidate.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return false;
  }
}
