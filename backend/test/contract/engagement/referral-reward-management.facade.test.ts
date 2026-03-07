import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma, RewardType } from '@prisma/client';
import { RewardsService } from '@/modules/referrals/rewards.service';
import { EngagementReferralRewardManagementPort } from '@/contexts/engagement/ports/outbound/referral-reward-management.port';

const basePort = (): EngagementReferralRewardManagementPort => ({
  getWalletSummary: async () => ({ wallet: { balance: 0 } }),
  getAvailableBalance: async () => 0,
  reserveWalletHold: async () => 0,
  confirmWalletHold: async () => undefined,
  releaseWalletHold: async () => undefined,
  validateCoupon: async () => ({ id: 'coupon-1' }),
  calculateCouponDiscount: () => 0,
  reserveCouponUsage: async () => undefined,
  confirmCouponUsage: async () => undefined,
  cancelCouponUsage: async () => undefined,
  issueReward: async () => undefined,
  voidReferralRewards: async () => undefined,
});

test('rewards facade delegates wallet summary', async () => {
  const calls: string[] = [];
  const service = new RewardsService({
    ...basePort(),
    getWalletSummary: async (userId) => {
      calls.push(userId);
      return { wallet: { balance: 15 } };
    },
  });

  const result = await service.getWalletSummary('user-1');

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'user-1');
  assert.equal((result as { wallet: { balance: number } }).wallet.balance, 15);
});

test('rewards facade delegates issue reward with tx', async () => {
  const calls: Array<{ userId: string; tx: unknown }> = [];
  const service = new RewardsService({
    ...basePort(),
    issueReward: async (params, tx) => {
      calls.push({ userId: params.userId, tx });
    },
  });

  const tx = {} as Prisma.TransactionClient;
  await service.issueReward(
    {
      userId: 'user-2',
      referralAttributionId: 'attr-1',
      rewardType: RewardType.WALLET,
      rewardValue: 5,
      description: 'reward',
    },
    tx,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].userId, 'user-2');
  assert.equal(calls[0].tx, tx);
});
