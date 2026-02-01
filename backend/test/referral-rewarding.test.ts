import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReferralAttributionService } from '../src/modules/referrals/referral-attribution.service';
import { runWithTenantContextAsync } from '../src/tenancy/tenant.context';

test('issues rewards when first appointment is completed', async () => {
  const issued: any[] = [];
  const attributionUpdates: any[] = [];

  const prisma = {
    appointment: {
      findFirst: async () => ({
        id: 'apt-1',
        localId: 'local-1',
        status: 'completed',
        referralAttributionId: 'attr-1',
        userId: 'user-2',
        serviceId: 'service-1',
        guestContact: null,
        startDateTime: new Date('2024-02-10T10:00:00Z'),
      }),
    },
    referralAttribution: {
      findFirst: async () => ({
        id: 'attr-1',
        localId: 'local-1',
        status: 'BOOKED',
        firstAppointmentId: 'apt-1',
        referrerUserId: 'user-1',
        referredUserId: 'user-2',
        metadata: {},
        expiresAt: new Date('2024-03-01T00:00:00Z'),
      }),
      update: async (payload: any) => {
        attributionUpdates.push(payload);
        return payload;
      },
    },
    user: {
      findMany: async () => [
        { id: 'user-1', name: 'Referrer', email: 'referrer@example.com', notificationEmail: false },
        { id: 'user-2', name: 'Referred', email: 'referred@example.com', notificationEmail: false },
      ],
    },
    $transaction: async (fn: any) => fn(prisma),
  } as any;

  const configService = {
    getConfig: async () => ({
      enabled: true,
      attributionExpiryDays: 30,
      newCustomerOnly: false,
      monthlyMaxRewardsPerReferrer: null,
      allowedServiceIds: null,
      rewardReferrerType: 'WALLET',
      rewardReferrerValue: 5,
      rewardReferrerServiceId: null,
      rewardReferrerServiceName: null,
      rewardReferredType: 'WALLET',
      rewardReferredValue: 5,
      rewardReferredServiceId: null,
      rewardReferredServiceName: null,
      antiFraud: {},
    }),
    isModuleEnabled: async () => true,
  } as any;

  const codeService = {} as any;
  const rewardsService = {
    issueReward: async (payload: any) => {
      issued.push(payload);
    },
  } as any;
  const notificationsService = {
    sendReferralRewardEmail: async () => undefined,
  } as any;

  const service = new ReferralAttributionService(
    prisma,
    configService,
    codeService,
    rewardsService,
    notificationsService,
  );

  await runWithTenantContextAsync({ localId: 'local-1' }, () => service.handleAppointmentCompleted('apt-1'));

  assert.equal(issued.length, 2);
  assert.equal(issued[0].userId, 'user-1');
  assert.equal(issued[1].userId, 'user-2');
  assert.ok(attributionUpdates.some((entry) => entry.data?.status === 'REWARDED'));
});
