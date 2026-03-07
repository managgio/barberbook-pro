import {
  parseEngagementContactTokens,
} from '../../domain/services/referral-contact';
import {
  EngagementReferralAttributionPersistencePort,
} from '../../ports/outbound/referral-attribution-persistence.port';

const ALLOWED_PENDING_STATUSES = new Set(['ATTRIBUTED', 'BOOKED']);

export class ResolveReferralAttributionForBookingError extends Error {
  constructor(public readonly code: 'INVALID_ATTRIBUTION', message: string) {
    super(message);
  }
}

export type ResolveReferralAttributionForBookingQuery = {
  localId: string;
  referralAttributionId?: string | null;
  userId?: string | null;
  guestContact?: string | null;
  now?: Date;
};

export class ResolveReferralAttributionForBookingUseCase {
  constructor(private readonly persistence: EngagementReferralAttributionPersistencePort) {}

  async execute(query: ResolveReferralAttributionForBookingQuery): Promise<{ id: string } | null> {
    const now = query.now ?? new Date();

    if (query.referralAttributionId) {
      const attribution = await this.persistence.findAttributionById({
        localId: query.localId,
        attributionId: query.referralAttributionId,
      });
      if (!attribution) {
        throw new ResolveReferralAttributionForBookingError(
          'INVALID_ATTRIBUTION',
          'La atribución del referido no es válida.',
        );
      }
      if (!ALLOWED_PENDING_STATUSES.has(attribution.status)) return null;
      if (attribution.expiresAt < now) return null;
      return { id: attribution.id };
    }

    if (query.userId) {
      const attribution = await this.persistence.findLatestPendingAttributionByUser({
        localId: query.localId,
        userId: query.userId,
        now,
      });
      return attribution ? { id: attribution.id } : null;
    }

    if (query.guestContact) {
      const { email, phone } = parseEngagementContactTokens(query.guestContact);
      if (!email && !phone) return null;
      const attribution = await this.persistence.findLatestPendingAttributionByContact({
        localId: query.localId,
        email,
        phone,
        now,
      });
      return attribution ? { id: attribution.id } : null;
    }

    return null;
  }
}
