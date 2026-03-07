export const ENGAGEMENT_REFERRAL_ATTRIBUTION_PORT = Symbol('ENGAGEMENT_REFERRAL_ATTRIBUTION_PORT');

export type BookingReferralAttribution = {
  id: string;
};

export interface EngagementReferralAttributionPort {
  resolveAttributionForBooking(params: {
    referralAttributionId?: string | null;
    userId?: string | null;
    guestContact?: string | null;
  }): Promise<BookingReferralAttribution | null>;
  attachAttributionToAppointment(params: {
    attributionId: string;
    appointmentId: string;
    userId?: string | null;
    guestContact?: string | null;
    tx?: unknown;
  }): Promise<void>;
  handleAppointmentCancelled(appointmentId: string): Promise<void>;
  handleAppointmentCompleted(appointmentId: string): Promise<void>;
}
