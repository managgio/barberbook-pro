export const ENGAGEMENT_REFERRAL_NOTIFICATION_PORT = Symbol('ENGAGEMENT_REFERRAL_NOTIFICATION_PORT');

export interface EngagementReferralNotificationPort {
  sendRewardEmail(params: {
    name: string | null;
    email: string;
    title: string;
    message: string;
  }): Promise<void>;
}
