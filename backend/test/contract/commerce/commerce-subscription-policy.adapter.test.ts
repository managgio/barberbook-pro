import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { PaymentMethod } from '@prisma/client';
import { ModuleCommerceSubscriptionPolicyAdapter } from '@/modules/subscriptions/adapters/module-commerce-subscription-policy.adapter';

test('delegates active subscription resolution to subscriptions service adapter', async () => {
  let called = false;
  const expected = {
    subscriptionId: 'sub-1',
    planId: 'plan-1',
    planName: 'Gold',
    paymentStatus: 'paid',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-12-31T23:59:59.999Z'),
  };
  const subscriptionsService = {
    resolveActiveSubscriptionForAppointment: async (userId: string | null | undefined, date: Date) => {
      called = true;
      assert.equal(userId, 'user-1');
      assert.equal(date.toISOString(), '2026-03-04T10:00:00.000Z');
      return expected;
    },
    hasUsableActiveSubscription: async () => false,
    settlePendingInPersonPaymentFromAppointment: async () => undefined,
  } as any;

  const adapter = new ModuleCommerceSubscriptionPolicyAdapter(subscriptionsService);
  const result = await adapter.resolveActiveSubscriptionForAppointment('user-1', new Date('2026-03-04T10:00:00.000Z'));
  assert.equal(called, true);
  assert.deepEqual(result, expected);
});

test('normalizes invalid payment method when settling pending subscription payment', async () => {
  let payload: Record<string, unknown> | null = null;
  const subscriptionsService = {
    resolveActiveSubscriptionForAppointment: async () => null,
    hasUsableActiveSubscription: async () => false,
    settlePendingInPersonPaymentFromAppointment: async (params: Record<string, unknown>) => {
      payload = params;
    },
  } as any;

  const adapter = new ModuleCommerceSubscriptionPolicyAdapter(subscriptionsService);
  await adapter.settlePendingInPersonPaymentFromAppointment({
    subscriptionId: 'sub-2',
    paymentMethod: 'not-a-real-method',
  });

  assert.deepEqual(payload, {
    subscriptionId: 'sub-2',
    paymentMethod: null,
    completedAt: undefined,
  });
});

test('keeps valid payment method when settling pending subscription payment', async () => {
  let payload: Record<string, unknown> | null = null;
  const subscriptionsService = {
    resolveActiveSubscriptionForAppointment: async () => null,
    hasUsableActiveSubscription: async () => false,
    settlePendingInPersonPaymentFromAppointment: async (params: Record<string, unknown>) => {
      payload = params;
    },
  } as any;

  const adapter = new ModuleCommerceSubscriptionPolicyAdapter(subscriptionsService);
  const validMethod = Object.values(PaymentMethod)[0] as string;
  await adapter.settlePendingInPersonPaymentFromAppointment({
    subscriptionId: 'sub-3',
    paymentMethod: validMethod,
    completedAt: new Date('2026-03-04T12:00:00.000Z'),
  });

  assert.deepEqual(payload, {
    subscriptionId: 'sub-3',
    paymentMethod: validMethod,
    completedAt: new Date('2026-03-04T12:00:00.000Z'),
  });
});
