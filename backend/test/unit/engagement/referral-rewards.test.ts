import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Prisma, RewardTxStatus, RewardTxType } from '@prisma/client';
import { PrismaSubscriptionReferralRewardManagementAdapter } from '@/modules/referrals/adapters/prisma-subscription-referral-reward-management.adapter';

test('confirmWalletHold creates debit and updates wallet', async () => {
  const updates: any[] = [];
  const creates: any[] = [];
  const walletUpdates: any[] = [];

  const prisma = {
    rewardTransaction: {
      findMany: async () => [
        {
          id: 'hold-1',
          localId: 'local-1',
          userId: 'user-1',
          appointmentId: 'apt-1',
          amount: new Prisma.Decimal(5),
        },
      ],
      update: async (payload: any) => {
        updates.push(payload);
        return payload;
      },
      create: async (payload: any) => {
        creates.push(payload);
        return payload;
      },
    },
    rewardWallet: {
      findFirst: async () => ({
        id: 'wallet-1',
        balance: new Prisma.Decimal(20),
        localId: 'local-1',
        userId: 'user-1',
      }),
      update: async (payload: any) => {
        walletUpdates.push(payload);
        return payload;
      },
      create: async () => ({
        id: 'wallet-1',
        balance: new Prisma.Decimal(0),
        localId: 'local-1',
        userId: 'user-1',
      }),
    },
    coupon: {
      findMany: async () => [],
    },
  } as any;

  const subscriptionsService = {
    hasUsableActiveSubscription: async () => false,
  } as any;
  const tenantContextPort = {
    getRequestContext: () => ({
      tenantId: 'brand-1',
      brandId: 'brand-1',
      localId: 'local-1',
      actorUserId: null,
      timezone: 'Europe/Madrid',
      correlationId: 'test-correlation-id',
    }),
  } as any;
  const service = new PrismaSubscriptionReferralRewardManagementAdapter(prisma, subscriptionsService, tenantContextPort);
  await service.confirmWalletHold('apt-1');

  assert.equal(updates.length, 1);
  assert.equal(updates[0].data.status, RewardTxStatus.CONFIRMED);
  assert.equal(creates.length, 1);
  assert.equal(creates[0].data.type, RewardTxType.DEBIT);
  assert.equal(walletUpdates.length, 1);
  assert.equal(walletUpdates[0].data.balance.decrement, 5);
});

test('releaseWalletHold cancels hold and creates release', async () => {
  const updates: any[] = [];
  const creates: any[] = [];

  const prisma = {
    rewardTransaction: {
      findMany: async () => [
        {
          id: 'hold-1',
          localId: 'local-1',
          userId: 'user-1',
          appointmentId: 'apt-1',
          amount: new Prisma.Decimal(6),
        },
      ],
      update: async (payload: any) => {
        updates.push(payload);
        return payload;
      },
      create: async (payload: any) => {
        creates.push(payload);
        return payload;
      },
    },
    rewardWallet: {
      findFirst: async () => null,
      create: async () => null,
    },
    coupon: {
      findMany: async () => [],
    },
  } as any;

  const subscriptionsService = {
    hasUsableActiveSubscription: async () => false,
  } as any;
  const tenantContextPort = {
    getRequestContext: () => ({
      tenantId: 'brand-1',
      brandId: 'brand-1',
      localId: 'local-1',
      actorUserId: null,
      timezone: 'Europe/Madrid',
      correlationId: 'test-correlation-id',
    }),
  } as any;
  const service = new PrismaSubscriptionReferralRewardManagementAdapter(prisma, subscriptionsService, tenantContextPort);
  await service.releaseWalletHold('apt-1');

  assert.equal(updates.length, 1);
  assert.equal(updates[0].data.status, RewardTxStatus.CANCELLED);
  assert.equal(creates.length, 1);
  assert.equal(creates[0].data.type, RewardTxType.RELEASE);
});
