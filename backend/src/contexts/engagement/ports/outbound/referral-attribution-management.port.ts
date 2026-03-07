import { ReferralAttributionStatus } from '@prisma/client';

export const ENGAGEMENT_REFERRAL_ATTRIBUTION_MANAGEMENT_PORT = Symbol(
  'ENGAGEMENT_REFERRAL_ATTRIBUTION_MANAGEMENT_PORT',
);

export type EngagementAttributeReferralInput = {
  code: string;
  channel: string;
  userId?: string;
  referredEmail?: string;
  referredPhone?: string;
};

export type EngagementReferralListParams = {
  status?: ReferralAttributionStatus;
  query?: string;
  page: number;
  pageSize: number;
};

export interface EngagementReferralAttributionManagementPort {
  getRewardSummaryPayload(): Promise<unknown>;
  getReferrerSummary(userId: string): Promise<unknown>;
  resolveReferral(code: string): Promise<unknown>;
  attributeReferral(data: EngagementAttributeReferralInput): Promise<unknown>;
  resolveAttributionForBooking(params: {
    referralAttributionId?: string | null;
    userId?: string | null;
    guestContact?: string | null;
  }): Promise<unknown | null>;
  attachAttributionToAppointment(params: {
    attributionId: string;
    appointmentId: string;
    userId?: string | null;
    guestContact?: string | null;
    tx?: unknown;
  }): Promise<unknown | null>;
  handleAppointmentCancelled(appointmentId: string): Promise<void>;
  handleAppointmentCompleted(appointmentId: string): Promise<void>;
  listReferrals(params: EngagementReferralListParams): Promise<unknown>;
  getOverview(params: { from?: Date; to?: Date }): Promise<unknown>;
  voidAttribution(id: string, reason: string): Promise<{ success: boolean }>;
}
