import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { SubscriptionDurationUnit } from '@prisma/client';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';
import { CommerceSubscriptionManagementPort } from '@/contexts/commerce/ports/outbound/subscription-management.port';

const basePort = (): CommerceSubscriptionManagementPort => ({
  listPlansAdmin: async () => [],
  listActivePlans: async () => [],
  createPlan: async () => ({
    id: 'plan-1',
    localId: 'loc-1',
    name: 'Plan',
    description: null,
    price: 10,
    durationValue: 1,
    durationUnit: 'months',
    isActive: true,
    isArchived: false,
    availabilityStartDate: null,
    availabilityEndDate: null,
    displayOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  updatePlan: async () => ({
    id: 'plan-1',
    localId: 'loc-1',
    name: 'Plan',
    description: null,
    price: 10,
    durationValue: 1,
    durationUnit: 'months',
    isActive: true,
    isArchived: false,
    availabilityStartDate: null,
    availabilityEndDate: null,
    displayOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  archivePlan: async () => ({ success: true }),
  listUserSubscriptions: async () => [],
  listUserSubscriptionsPage: async () => ({
    total: 0,
    page: 1,
    pageSize: 10,
    hasMore: false,
    items: [],
  }),
  getUserActiveSubscription: async () => null,
  assignUserSubscription: async () => {
    throw new Error('not implemented');
  },
  subscribeCurrentUser: async () => ({
    mode: 'next_appointment' as const,
    checkoutUrl: null,
    subscription: {
      id: 'sub-1',
      localId: 'loc-1',
      userId: 'user-1',
      planId: 'plan-1',
      status: 'active',
      source: 'client',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      paymentStatus: 'in_person',
      paymentMethod: null,
      paymentAmount: 10,
      paymentCurrency: 'eur',
      paymentPaidAt: null,
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: null,
      cancelledAt: null,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      plan: {
        id: 'plan-1',
        localId: 'loc-1',
        name: 'Plan',
        description: null,
        price: 10,
        durationValue: 1,
        durationUnit: 'months',
        isActive: true,
        isArchived: false,
        availabilityStartDate: null,
        availabilityEndDate: null,
        displayOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      isActiveNow: true,
      isUsableNow: true,
      isPaymentSettled: false,
    },
  }),
  markSubscriptionPaid: async () => {
    throw new Error('not implemented');
  },
  settlePendingInPersonPaymentFromAppointment: async () => null,
  hasUsableActiveSubscription: async () => false,
  resolveActiveSubscriptionForAppointment: async () => null,
});

test('subscriptions facade delegates create plan to management port', async () => {
  const calls: Array<{ name: string }> = [];
  const service = new SubscriptionsService({
    ...basePort(),
    createPlan: async (input) => {
      calls.push({ name: input.name });
      return {
        id: 'plan-2',
        localId: 'loc-1',
        name: input.name,
        description: null,
        price: input.price,
        durationValue: input.durationValue,
        durationUnit: input.durationUnit,
        isActive: true,
        isArchived: false,
        availabilityStartDate: null,
        availabilityEndDate: null,
        displayOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
  });

  const result = await service.createPlan({
    name: 'Premium',
    price: 20,
    durationValue: 1,
    durationUnit: SubscriptionDurationUnit.months,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'Premium');
  assert.equal(result.id, 'plan-2');
});

test('subscriptions facade delegates resolve active subscription lookup', async () => {
  const calls: string[] = [];
  const service = new SubscriptionsService({
    ...basePort(),
    resolveActiveSubscriptionForAppointment: async (userId, appointmentDate) => {
      calls.push(`${userId}:${appointmentDate.toISOString()}`);
      return {
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        planName: 'Premium',
        paymentStatus: 'paid',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.999Z'),
      };
    },
  });

  const result = await service.resolveActiveSubscriptionForAppointment(
    'user-123',
    new Date('2026-03-05T10:00:00.000Z'),
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'user-123:2026-03-05T10:00:00.000Z');
  assert.equal(result?.subscriptionId, 'sub-1');
});
