export const ENGAGEMENT_REFERRAL_REWARD_PORT = Symbol('ENGAGEMENT_REFERRAL_REWARD_PORT');

export interface EngagementReferralRewardPort {
  issueReward(params: {
    userId: string;
    referralAttributionId: string;
    rewardType: string;
    rewardValue: number | null;
    rewardServiceId?: string | null;
    description: string;
    tx?: unknown;
  }): Promise<void>;
}
