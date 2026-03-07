import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { HandleReferralAppointmentCompletedUseCase } from '@/contexts/engagement/application/use-cases/handle-referral-appointment-completed.use-case';

test('issues rewards and sends notifications when completed appointment is eligible', async () => {
  const statusUpdates: Array<Record<string, unknown>> = [];
  const rewardCalls: Array<Record<string, unknown>> = [];
  const notificationCalls: Array<Record<string, unknown>> = [];
  const txMarker = { kind: 'tx' };

  const persistence = {
    findAppointmentForReferralCompletion: async () => ({
      id: 'apt-1',
      status: 'completed',
      referralAttributionId: 'attr-1',
      userId: 'user-referred',
      serviceId: 'service-1',
      guestContact: 'guest@example.com',
      startDateTime: new Date('2026-03-01T10:00:00.000Z'),
    }),
    findAttributionById: async () => ({
      id: 'attr-1',
      status: 'BOOKED',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      firstAppointmentId: 'apt-1',
      referrerUserId: 'user-ref',
      referredUserId: 'user-referred',
      referredEmail: 'guest@example.com',
      referredPhone: null,
    }),
    getActiveReferralConfig: async () => ({
      antiFraud: { blockSelfByUser: true, blockSelfByContact: true, blockDuplicateByContact: true },
      newCustomerOnly: true,
      allowedServiceIds: ['service-1'],
      monthlyMaxRewardsPerReferrer: 3,
      rewardReferrerType: 'WALLET',
      rewardReferrerValue: 10,
      rewardReferrerServiceId: null,
      rewardReferrerServiceName: null,
      rewardReferredType: 'WALLET',
      rewardReferredValue: 5,
      rewardReferredServiceId: null,
      rewardReferredServiceName: null,
    }),
    findPreviousCompletedCustomerAppointment: async () => false,
    countRewardedAttributionsByReferrer: async () => 0,
    updateAttributionStatus: async (payload: Record<string, unknown>) => {
      statusUpdates.push(payload);
    },
    runInTransaction: async (work: (tx: unknown) => Promise<void>) => {
      await work(txMarker);
    },
    findUsersByIds: async () => [
      { id: 'user-ref', name: 'Referrer', email: 'referrer@example.com', notificationEmail: true },
      { id: 'user-referred', name: 'Referred', email: 'referred@example.com', notificationEmail: true },
    ],
  } as any;

  const rewardPort = {
    issueReward: async (payload: Record<string, unknown>) => {
      rewardCalls.push(payload);
    },
  } as any;

  const notificationPort = {
    sendRewardEmail: async (payload: Record<string, unknown>) => {
      notificationCalls.push(payload);
    },
  } as any;

  const useCase = new HandleReferralAppointmentCompletedUseCase(
    persistence,
    rewardPort,
    notificationPort,
  );

  await useCase.execute({
    localId: 'local-1',
    appointmentId: 'apt-1',
    now: new Date('2026-03-04T12:00:00.000Z'),
  });

  assert.deepEqual(statusUpdates, [
    { attributionId: 'attr-1', status: 'COMPLETED' },
    { attributionId: 'attr-1', status: 'REWARDED', tx: txMarker },
  ]);
  assert.equal(rewardCalls.length, 2);
  assert.equal(rewardCalls[0].userId, 'user-ref');
  assert.equal(rewardCalls[1].userId, 'user-referred');
  assert.equal(rewardCalls[0].tx, txMarker);
  assert.equal(rewardCalls[1].tx, txMarker);
  assert.equal(notificationCalls.length, 2);
});

test('voids attribution when service is not allowed', async () => {
  const statusUpdates: Array<Record<string, unknown>> = [];
  const rewardCalls: Array<Record<string, unknown>> = [];

  const persistence = {
    findAppointmentForReferralCompletion: async () => ({
      id: 'apt-1',
      status: 'completed',
      referralAttributionId: 'attr-1',
      userId: 'user-referred',
      serviceId: 'service-denied',
      guestContact: null,
      startDateTime: new Date('2026-03-01T10:00:00.000Z'),
    }),
    findAttributionById: async () => ({
      id: 'attr-1',
      status: 'ATTRIBUTED',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      firstAppointmentId: null,
      referrerUserId: 'user-ref',
      referredUserId: null,
      referredEmail: null,
      referredPhone: null,
    }),
    getActiveReferralConfig: async () => ({
      antiFraud: { blockSelfByUser: true, blockSelfByContact: true, blockDuplicateByContact: true },
      newCustomerOnly: false,
      allowedServiceIds: ['service-1'],
      monthlyMaxRewardsPerReferrer: null,
      rewardReferrerType: 'WALLET',
      rewardReferrerValue: 10,
      rewardReferrerServiceId: null,
      rewardReferrerServiceName: null,
      rewardReferredType: 'WALLET',
      rewardReferredValue: 5,
      rewardReferredServiceId: null,
      rewardReferredServiceName: null,
    }),
    findPreviousCompletedCustomerAppointment: async () => false,
    countRewardedAttributionsByReferrer: async () => 0,
    updateAttributionStatus: async (payload: Record<string, unknown>) => {
      statusUpdates.push(payload);
    },
    runInTransaction: async () => undefined,
    findUsersByIds: async () => [],
  } as any;

  const useCase = new HandleReferralAppointmentCompletedUseCase(
    persistence,
    {
      issueReward: async (payload: Record<string, unknown>) => {
        rewardCalls.push(payload);
      },
    } as any,
    {
      sendRewardEmail: async () => undefined,
    } as any,
  );

  await useCase.execute({
    localId: 'local-1',
    appointmentId: 'apt-1',
    now: new Date('2026-03-04T12:00:00.000Z'),
  });

  assert.deepEqual(statusUpdates, [
    {
      attributionId: 'attr-1',
      status: 'VOIDED',
      metadataReason: 'service_not_allowed',
    },
  ]);
  assert.equal(rewardCalls.length, 0);
});
