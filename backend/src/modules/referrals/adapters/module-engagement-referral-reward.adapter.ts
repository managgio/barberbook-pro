import { Injectable } from '@nestjs/common';
import { Prisma, RewardType } from '@prisma/client';
import { EngagementReferralRewardPort } from '../../../contexts/engagement/ports/outbound/referral-reward.port';
import { RewardsService } from '../rewards.service';

const isRewardType = (value: string): value is RewardType =>
  (Object.values(RewardType) as string[]).includes(value);

@Injectable()
export class ModuleEngagementReferralRewardAdapter implements EngagementReferralRewardPort {
  constructor(private readonly rewardsService: RewardsService) {}

  async issueReward(params: {
    userId: string;
    referralAttributionId: string;
    rewardType: string;
    rewardValue: number | null;
    rewardServiceId?: string | null;
    description: string;
    tx?: unknown;
  }): Promise<void> {
    if (!isRewardType(params.rewardType)) return;
    await this.rewardsService.issueReward(
      {
        userId: params.userId,
        referralAttributionId: params.referralAttributionId,
        rewardType: params.rewardType,
        rewardValue: params.rewardValue,
        rewardServiceId: params.rewardServiceId,
        description: params.description,
      },
      params.tx as Prisma.TransactionClient | undefined,
    );
  }
}
