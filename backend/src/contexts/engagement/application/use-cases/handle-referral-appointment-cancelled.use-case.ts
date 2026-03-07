import { EngagementReferralAttributionPersistencePort } from '../../ports/outbound/referral-attribution-persistence.port';

const ALLOWED_PENDING_STATUSES = new Set(['ATTRIBUTED', 'BOOKED']);

export class HandleReferralAppointmentCancelledUseCase {
  constructor(private readonly persistence: EngagementReferralAttributionPersistencePort) {}

  async execute(params: { localId: string; appointmentId: string; now?: Date }): Promise<void> {
    const now = params.now ?? new Date();
    const attribution = await this.persistence.findAttributionByFirstAppointment({
      localId: params.localId,
      appointmentId: params.appointmentId,
    });
    if (!attribution) return;
    if (!ALLOWED_PENDING_STATUSES.has(attribution.status)) return;
    const expired = attribution.expiresAt < now;
    await this.persistence.updateAttributionStatus({
      attributionId: attribution.id,
      status: expired ? 'EXPIRED' : 'ATTRIBUTED',
      firstAppointmentId: null,
    });
  }
}
