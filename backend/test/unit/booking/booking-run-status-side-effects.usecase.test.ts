import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { RunAppointmentStatusSideEffectsUseCase } from '@/contexts/booking/application/use-cases/run-appointment-status-side-effects.use-case';

const buildUseCase = (hooks?: { failEffect?: string; skipKeyIncludes?: string }) => {
  const calls: string[] = [];

  const useCase = new RunAppointmentStatusSideEffectsUseCase(
    {
      confirmWalletHold: async () => { calls.push('confirmWalletHold'); },
      confirmCouponUsage: async () => { calls.push('confirmCouponUsage'); },
      releaseWalletHold: async () => { calls.push('releaseWalletHold'); },
      cancelCouponUsage: async () => { calls.push('cancelCouponUsage'); },
      handleReferralCompleted: async () => { calls.push('handleReferralCompleted'); },
      handleReferralCancelled: async () => { calls.push('handleReferralCancelled'); },
      handleReviewCompleted: async () => { calls.push('handleReviewCompleted'); },
      getAppointmentSettlementContext: async () => {
        calls.push('getAppointmentSettlementContext');
        return { subscriptionId: 'sub-1', paymentMethod: 'in_person' };
      },
      settleSubscriptionInPersonPayment: async () => {
        calls.push('settleSubscriptionInPersonPayment');
      },
    },
    {
      runOnce: async (key, work) => {
        if (hooks?.skipKeyIncludes && key.includes(hooks.skipKeyIncludes)) return false;
        if (hooks?.failEffect && key.includes(hooks.failEffect)) {
          throw new Error(`boom:${hooks.failEffect}`);
        }
        await work();
        return true;
      },
    },
  );

  return { useCase, calls };
};

test('completed status executes completion side effects with settlement step', async () => {
  const { useCase, calls } = buildUseCase();

  const result = await useCase.execute({
    localId: 'local-1',
    appointmentId: 'app-1',
    nextStatus: 'completed',
  });

  assert.deepEqual(result.failures, []);
  assert.deepEqual(calls, [
    'confirmWalletHold',
    'confirmCouponUsage',
    'handleReferralCompleted',
    'getAppointmentSettlementContext',
    'settleSubscriptionInPersonPayment',
    'handleReviewCompleted',
  ]);
});

test('cancelled status executes cancellation side effects only', async () => {
  const { useCase, calls } = buildUseCase();

  const result = await useCase.execute({
    localId: 'local-1',
    appointmentId: 'app-1',
    nextStatus: 'cancelled',
  });

  assert.deepEqual(result.failures, []);
  assert.deepEqual(calls, [
    'releaseWalletHold',
    'cancelCouponUsage',
    'handleReferralCancelled',
  ]);
});

test('records failures and continues executing remaining effects', async () => {
  const { useCase, calls } = buildUseCase({ failEffect: 'confirmCouponUsage' });

  const result = await useCase.execute({
    localId: 'local-1',
    appointmentId: 'app-1',
    nextStatus: 'completed',
  });

  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].effect, 'confirmCouponUsage');
  assert.ok(result.failures[0].message.includes('boom:confirmCouponUsage'));
  assert.ok(calls.includes('confirmWalletHold'));
  assert.ok(calls.includes('handleReviewCompleted'));
});
