import { Inject, Injectable } from '@nestjs/common';
import { Prisma, RewardType } from '@prisma/client';
import {
  ENGAGEMENT_REFERRAL_REWARD_MANAGEMENT_PORT,
  EngagementReferralRewardManagementPort,
} from '../../contexts/engagement/ports/outbound/referral-reward-management.port';

@Injectable()
export class RewardsService {
  constructor(
    @Inject(ENGAGEMENT_REFERRAL_REWARD_MANAGEMENT_PORT)
    private readonly referralRewardManagementPort: EngagementReferralRewardManagementPort,
  ) {}

  getWalletSummary(userId: string) {
    return this.referralRewardManagementPort.getWalletSummary(userId);
  }

  getAvailableBalance(userId: string, tx?: Prisma.TransactionClient) {
    return this.referralRewardManagementPort.getAvailableBalance(userId, tx);
  }

  reserveWalletHold(
    params: {
      userId: string;
      appointmentId: string;
      amount: number;
      description: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    return this.referralRewardManagementPort.reserveWalletHold(params, tx);
  }

  confirmWalletHold(appointmentId: string, tx?: Prisma.TransactionClient) {
    return this.referralRewardManagementPort.confirmWalletHold(appointmentId, tx);
  }

  releaseWalletHold(appointmentId: string, tx?: Prisma.TransactionClient) {
    return this.referralRewardManagementPort.releaseWalletHold(appointmentId, tx);
  }

  validateCoupon(
    params: {
      userId: string;
      couponId: string;
      serviceId: string;
      referenceDate: Date;
    },
    tx?: Prisma.TransactionClient,
  ) {
    return this.referralRewardManagementPort.validateCoupon(params, tx);
  }

  calculateCouponDiscount(params: {
    couponType: RewardType;
    couponValue: number | null;
    baseServicePrice: number;
  }) {
    return this.referralRewardManagementPort.calculateCouponDiscount(params);
  }

  reserveCouponUsage(
    params: {
      userId: string;
      couponId: string;
      appointmentId: string;
      amount: number;
      description: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    return this.referralRewardManagementPort.reserveCouponUsage(params, tx);
  }

  confirmCouponUsage(appointmentId: string, tx?: Prisma.TransactionClient) {
    return this.referralRewardManagementPort.confirmCouponUsage(appointmentId, tx);
  }

  cancelCouponUsage(appointmentId: string, tx?: Prisma.TransactionClient) {
    return this.referralRewardManagementPort.cancelCouponUsage(appointmentId, tx);
  }

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
  ) {
    return this.referralRewardManagementPort.issueReward(params, tx);
  }

  voidReferralRewards(referralAttributionId: string, reason: string, tx?: Prisma.TransactionClient) {
    return this.referralRewardManagementPort.voidReferralRewards(referralAttributionId, reason, tx);
  }
}
