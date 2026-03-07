import { Prisma, RewardType } from '@prisma/client';

export const ENGAGEMENT_REFERRAL_REWARD_MANAGEMENT_PORT = Symbol('ENGAGEMENT_REFERRAL_REWARD_MANAGEMENT_PORT');

export interface EngagementReferralRewardManagementPort {
  getWalletSummary(userId: string): Promise<unknown>;
  getAvailableBalance(userId: string, tx?: Prisma.TransactionClient): Promise<number>;
  reserveWalletHold(
    params: {
      userId: string;
      appointmentId: string;
      amount: number;
      description: string;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<number>;
  confirmWalletHold(appointmentId: string, tx?: Prisma.TransactionClient): Promise<void>;
  releaseWalletHold(appointmentId: string, tx?: Prisma.TransactionClient): Promise<void>;
  validateCoupon(
    params: {
      userId: string;
      couponId: string;
      serviceId: string;
      referenceDate: Date;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<unknown>;
  calculateCouponDiscount(params: {
    couponType: RewardType;
    couponValue: number | null;
    baseServicePrice: number;
  }): number;
  reserveCouponUsage(
    params: {
      userId: string;
      couponId: string;
      appointmentId: string;
      amount: number;
      description: string;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
  confirmCouponUsage(appointmentId: string, tx?: Prisma.TransactionClient): Promise<void>;
  cancelCouponUsage(appointmentId: string, tx?: Prisma.TransactionClient): Promise<void>;
  issueReward(
    params: {
      userId: string;
      referralAttributionId: string;
      rewardType: RewardType;
      rewardValue: number | null;
      rewardServiceId?: string | null;
      description: string;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
  voidReferralRewards(
    referralAttributionId: string,
    reason: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
}
