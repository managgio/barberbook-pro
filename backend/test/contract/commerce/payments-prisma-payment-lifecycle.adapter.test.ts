import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { PrismaPaymentLifecycleAdapter } from '@/modules/payments/adapters/prisma-payment-lifecycle.adapter';

test('markAppointmentPaid updates appointment and sends payment confirmation in tenant context', async () => {
  const calls: { context?: Record<string, string>; updated?: any; confirmed?: string } = {};
  const prisma = {
    appointment: {
      update: async (payload: unknown) => {
        calls.updated = payload;
      },
    },
    userSubscription: {
      updateMany: async () => undefined,
    },
  } as any;
  const tenantContextRunnerPort = {
    runWithContext: async (context: Record<string, string>, fn: () => Promise<void>) => {
      calls.context = context;
      await fn();
    },
  } as any;
  const appointmentsFacade = {
    sendPaymentConfirmation: async (appointmentId: string) => {
      calls.confirmed = appointmentId;
    },
    update: async () => undefined,
  } as any;

  const adapter = new PrismaPaymentLifecycleAdapter(
    prisma,
    tenantContextRunnerPort,
    appointmentsFacade,
  );

  await adapter.markAppointmentPaid({
    appointmentId: 'appt-1',
    localId: 'loc-1',
    brandId: 'brand-1',
    amountTotal: 45,
    currency: 'eur',
    paidAt: new Date('2026-03-05T12:00:00.000Z'),
  });

  assert.deepEqual(calls.context, { localId: 'loc-1', brandId: 'brand-1' });
  assert.equal(calls.updated?.where?.id, 'appt-1');
  assert.equal(calls.updated?.data?.paymentCurrency, 'eur');
  assert.equal(calls.confirmed, 'appt-1');
});

test('cancelAppointmentPaymentAndBooking updates payment and delegates appointment cancellation', async () => {
  const calls: { context?: Record<string, string>; updated?: any; cancelled?: any[] } = {};
  const prisma = {
    appointment: {
      update: async (payload: unknown) => {
        calls.updated = payload;
      },
    },
    userSubscription: {
      updateMany: async () => undefined,
    },
  } as any;
  const tenantContextRunnerPort = {
    runWithContext: async (context: Record<string, string>, fn: () => Promise<void>) => {
      calls.context = context;
      await fn();
    },
  } as any;
  const appointmentsFacade = {
    sendPaymentConfirmation: async () => undefined,
    update: async (...args: any[]) => {
      calls.cancelled = args;
    },
  } as any;

  const adapter = new PrismaPaymentLifecycleAdapter(
    prisma,
    tenantContextRunnerPort,
    appointmentsFacade,
  );

  await adapter.cancelAppointmentPaymentAndBooking({
    appointmentId: 'appt-2',
    localId: 'loc-2',
    brandId: 'brand-2',
    reason: 'stripe_timeout',
    cancelledAt: new Date('2026-03-05T12:00:00.000Z'),
  });

  assert.deepEqual(calls.context, { localId: 'loc-2', brandId: 'brand-2' });
  assert.equal(calls.updated?.where?.id, 'appt-2');
  assert.equal(calls.updated?.data?.paymentExpiresAt, null);
  assert.deepEqual(calls.cancelled, ['appt-2', { status: 'cancelled' }, { actorUserId: null }]);
});
