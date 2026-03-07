export const ENGAGEMENT_REFERRAL_CODE_MANAGEMENT_PORT = Symbol('ENGAGEMENT_REFERRAL_CODE_MANAGEMENT_PORT');

export type EngagementReferralCodePayload = {
  id: string;
  localId: string;
  userId: string;
  code: string;
  isActive: boolean;
};

export type EngagementResolvedReferralCodePayload = EngagementReferralCodePayload & {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
};

export interface EngagementReferralCodeManagementPort {
  getOrCreateCode(userId: string): Promise<EngagementReferralCodePayload>;
  resolveCode(code: string): Promise<EngagementResolvedReferralCodePayload>;
}
