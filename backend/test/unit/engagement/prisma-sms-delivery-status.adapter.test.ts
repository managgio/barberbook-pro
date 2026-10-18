import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotificationDeliveryStatus } from '@prisma/client';
import { PrismaSmsDeliveryStatusAdapter } from '@/contexts/engagement/infrastructure/prisma/prisma-sms-delivery-status.adapter';

test('SMS delivery receipt advances an accepted delivery to delivered', async () => {
  let update: any = null;
  const adapter = new PrismaSmsDeliveryStatusAdapter({
    notificationDelivery: {
      findFirst: async () => ({
        id: 'delivery-1',
        status: NotificationDeliveryStatus.accepted,
        attemptCount: 1,
        providerMessageId: 'SM11111111111111111111111111111111',
        acceptedAt: new Date('2026-10-17T10:00:00.000Z'),
        sentAt: null,
      }),
      updateMany: async (params: any) => {
        update = params;
        return { count: 1 };
      },
    },
  } as any);

  const result = await adapter.record({
    deliveryReference: 'delivery-1',
    providerMessageId: 'SM11111111111111111111111111111111',
    status: 'delivered',
    occurredAt: new Date('2026-10-17T10:00:05.000Z'),
  });

  assert.deepEqual(result, { recorded: true, deliveryId: 'delivery-1' });
  assert.equal(update.data.status, NotificationDeliveryStatus.delivered);
  assert.equal(update.data.deliveredAt.toISOString(), '2026-10-17T10:00:05.000Z');
  assert.equal(update.data.sentAt.toISOString(), '2026-10-17T10:00:05.000Z');
  assert.equal(update.data.lastErrorCode, null);
});

test('SMS delivery receipt never downgrades a delivered message to sent', async () => {
  let updateCalled = false;
  const adapter = new PrismaSmsDeliveryStatusAdapter({
    notificationDelivery: {
      findFirst: async () => ({
        id: 'delivery-1',
        status: NotificationDeliveryStatus.delivered,
        attemptCount: 1,
        providerMessageId: 'SM11111111111111111111111111111111',
        acceptedAt: new Date(),
        sentAt: new Date(),
      }),
      updateMany: async () => {
        updateCalled = true;
        return { count: 1 };
      },
    },
  } as any);

  const result = await adapter.record({
    deliveryReference: 'delivery-1',
    providerMessageId: 'SM11111111111111111111111111111111',
    status: 'sent',
    occurredAt: new Date(),
  });

  assert.deepEqual(result, { recorded: false, reason: 'stale_status' });
  assert.equal(updateCalled, false);
});

test('SMS delivery receipt rejects a provider message mismatch', async () => {
  const adapter = new PrismaSmsDeliveryStatusAdapter({
    notificationDelivery: {
      findFirst: async () => ({
        id: 'delivery-1',
        status: NotificationDeliveryStatus.accepted,
        attemptCount: 1,
        providerMessageId: 'SM11111111111111111111111111111111',
        acceptedAt: new Date(),
        sentAt: null,
      }),
    },
  } as any);

  const result = await adapter.record({
    deliveryReference: 'delivery-1',
    providerMessageId: 'SM22222222222222222222222222222222',
    status: 'undelivered',
    occurredAt: new Date(),
  });

  assert.deepEqual(result, { recorded: false, reason: 'provider_message_mismatch' });
});

test('a provider failure never records the SMS as sent', async () => {
  let update: any = null;
  const adapter = new PrismaSmsDeliveryStatusAdapter({
    notificationDelivery: {
      findFirst: async () => ({
        id: 'delivery-1',
        status: NotificationDeliveryStatus.accepted,
        attemptCount: 1,
        providerMessageId: 'SM11111111111111111111111111111111',
        acceptedAt: new Date('2026-10-17T10:00:00.000Z'),
        sentAt: null,
      }),
      updateMany: async (params: any) => {
        update = params;
        return { count: 1 };
      },
    },
  } as any);

  const result = await adapter.record({
    deliveryReference: 'attempt-reference-1',
    providerMessageId: 'SM11111111111111111111111111111111',
    status: 'failed',
    providerErrorCode: '30034',
    occurredAt: new Date('2026-10-17T10:00:05.000Z'),
  });

  assert.deepEqual(result, { recorded: true, deliveryId: 'delivery-1' });
  assert.equal(update.data.status, NotificationDeliveryStatus.failed);
  assert.equal(update.data.sentAt, undefined);
  assert.equal(update.data.failedAt.toISOString(), '2026-10-17T10:00:05.000Z');
  assert.equal(update.data.lastErrorCode, 'SMS_DELIVERY_FAILED_30034');
});

test('a late callback from the previous attempt cannot terminalize a retry in progress', async () => {
  const delivery = {
    id: 'delivery-1',
    activeAttemptReference: 'new-attempt-reference',
    attemptCount: 2,
    status: NotificationDeliveryStatus.processing,
    providerMessageId: null,
    acceptedAt: null,
    sentAt: null,
  };
  let updateCalled = false;
  const adapter = new PrismaSmsDeliveryStatusAdapter({
    notificationDelivery: {
      findFirst: async (params: any) => params.where.activeAttemptReference === delivery.activeAttemptReference
        ? delivery
        : null,
      updateMany: async () => {
        updateCalled = true;
        return { count: 1 };
      },
    },
  } as any);

  const result = await adapter.record({
    deliveryReference: 'old-attempt-reference',
    providerMessageId: 'SM11111111111111111111111111111111',
    status: 'delivered',
    occurredAt: new Date('2026-10-17T10:10:00.000Z'),
  });

  assert.deepEqual(result, { recorded: false, reason: 'not_found' });
  assert.equal(updateCalled, false);
  assert.equal(delivery.status, NotificationDeliveryStatus.processing);
  assert.equal(delivery.providerMessageId, null);
});

test('a callback from the active attempt can resolve an ambiguous SDK failure before retry claim', async () => {
  let update: any = null;
  const adapter = new PrismaSmsDeliveryStatusAdapter({
    notificationDelivery: {
      findFirst: async () => ({
        id: 'delivery-1',
        status: NotificationDeliveryStatus.retrying,
        attemptCount: 1,
        providerMessageId: null,
        acceptedAt: null,
        sentAt: null,
      }),
      updateMany: async (params: any) => {
        update = params;
        return { count: 1 };
      },
    },
  } as any);

  const result = await adapter.record({
    deliveryReference: 'attempt-reference-1',
    providerMessageId: 'SM11111111111111111111111111111111',
    status: 'delivered',
    occurredAt: new Date('2026-10-17T10:00:05.000Z'),
  });

  assert.deepEqual(result, { recorded: true, deliveryId: 'delivery-1' });
  assert.equal(update.where.activeAttemptReference, 'attempt-reference-1');
  assert.equal(update.where.attemptCount, 1);
  assert.equal(update.data.status, NotificationDeliveryStatus.delivered);
  assert.equal(update.data.nextAttemptAt, null);
});
