import {
  normalizeEngagementAntiFraud,
  parseEngagementContactTokens,
} from '../../domain/services/referral-contact';
import { EngagementReferralAttributionPersistencePort } from '../../ports/outbound/referral-attribution-persistence.port';

const ALLOWED_PENDING_STATUSES = new Set(['ATTRIBUTED', 'BOOKED']);

export type AttachReferralAttributionToAppointmentCommand = {
  localId: string;
  attributionId: string;
  appointmentId: string;
  userId?: string | null;
  guestContact?: string | null;
  tx?: unknown;
  now?: Date;
};

export class AttachReferralAttributionToAppointmentUseCase {
  constructor(private readonly persistence: EngagementReferralAttributionPersistencePort) {}

  async execute(command: AttachReferralAttributionToAppointmentCommand): Promise<void> {
    const now = command.now ?? new Date();
    const attribution = await this.persistence.findAttributionById({
      localId: command.localId,
      attributionId: command.attributionId,
      tx: command.tx,
    });
    if (!attribution) return;
    if (!ALLOWED_PENDING_STATUSES.has(attribution.status)) return;
    if (attribution.expiresAt < now) return;

    if (attribution.firstAppointmentId && attribution.firstAppointmentId !== command.appointmentId) {
      return;
    }

    const activeConfig = await this.persistence.getActiveReferralConfig();
    if (!activeConfig) return;
    const antiFraud = normalizeEngagementAntiFraud(activeConfig.antiFraud);

    if (antiFraud.blockSelfByUser && command.userId && command.userId === attribution.referrerUserId) {
      return;
    }

    const contact = parseEngagementContactTokens(command.guestContact ?? null);
    if (antiFraud.blockSelfByContact) {
      const referrer = await this.persistence.getUserContact({
        userId: attribution.referrerUserId,
        tx: command.tx,
      });
      if (referrer?.email && contact.email && referrer.email === contact.email) return;
      if (referrer?.phone && contact.phone && referrer.phone === contact.phone) return;
    }

    await this.persistence.markAttributionBooked({
      attributionId: attribution.id,
      appointmentId: command.appointmentId,
      referredUserId: attribution.referredUserId ?? command.userId ?? null,
      referredEmail: attribution.referredEmail ?? contact.email,
      referredPhone: attribution.referredPhone ?? contact.phone,
      tx: command.tx,
    });
  }
}
