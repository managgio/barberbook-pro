import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotificationDeliveryHistoryService } from '@/modules/notifications/notification-delivery-history.service';

test('tenant delivery history is paginated and restricted to enabled channels', async () => {
  let findManyQuery: any = null;
  const prisma: any = {
    notificationDelivery: {
      count: async () => 0,
      findMany: async (params: any) => {
        findManyQuery = params;
        return [];
      },
      groupBy: async () => [],
    },
    $transaction: async (promises: Promise<unknown>[]) => Promise.all(promises),
  };
  const service = new NotificationDeliveryHistoryService(
    prisma,
    { getRequestContext: () => ({ brandId: 'brand-1', localId: 'local-1' }) } as any,
    { getEffectiveConfig: async () => ({ notificationPrefs: { email: true, sms: true, whatsapp: false } }) } as any,
    {} as any,
  );

  const result = await service.listForCurrentTenant({ page: 3, pageSize: 25 });

  assert.deepEqual(result.enabledChannels, ['email', 'sms']);
  assert.equal(findManyQuery.skip, 50);
  assert.equal(findManyQuery.take, 25);
  const serializedWhere = JSON.stringify(findManyQuery.where);
  assert.match(serializedWhere, /brand-1/);
  assert.match(serializedWhere, /local-1/);
  assert.match(serializedWhere, /email/);
  assert.match(serializedWhere, /sms/);
  assert.doesNotMatch(serializedWhere, /whatsapp/);
  assert.match(serializedWhere, /retrying/);
  assert.match(serializedWhere, /failed/);
});

test('tenant delivery history exposes the backend manual-retry decision', async () => {
  const now = new Date('2026-10-17T12:00:00.000Z');
  const prisma: any = {
    notificationDelivery: {
      count: async () => 1,
      findMany: async () => [{
        id: 'delivery-too-long',
        brandId: 'brand-1',
        brand: { name: 'Brand' },
        localId: 'local-1',
        local: { name: 'Local' },
        appointmentId: 'appointment-1',
        channel: 'sms',
        kind: 'reminder',
        status: 'failed',
        recipientAddress: '+34600000000',
        recipientName: 'Client',
        title: 'Reminder',
        attemptCount: 1,
        maxAttempts: 5,
        nextAttemptAt: null,
        providerMessageId: null,
        lastErrorCode: 'SMS_MESSAGE_TOO_LONG',
        lastErrorMessage: 'The SMS exceeded the segment limit.',
        acceptedAt: null,
        sentAt: null,
        deliveredAt: null,
        undeliveredAt: null,
        deliveryStatusUpdatedAt: null,
        failedAt: now,
        skippedAt: null,
        createdAt: now,
        attempts: [],
      }],
      groupBy: async () => [],
    },
    $transaction: async (promises: Promise<unknown>[]) => Promise.all(promises),
  };
  const service = new NotificationDeliveryHistoryService(
    prisma,
    { getRequestContext: () => ({ brandId: 'brand-1', localId: 'local-1' }) } as any,
    { getEffectiveConfig: async () => ({ notificationPrefs: { sms: true } }) } as any,
    {} as any,
  );

  const result = await service.listForCurrentTenant({});

  assert.equal(result.items[0]?.canRetry, false);
});

test('tenant delivery history rejects retries for missing-recipient records', async () => {
  let attemptedUpdate = false;
  const service = new NotificationDeliveryHistoryService(
    {
      notificationDelivery: {
        findFirst: async () => ({
          channel: 'email',
          status: 'skipped',
          lastErrorCode: 'EMAIL_RECIPIENT_MISSING',
          activeAttemptReference: 'attempt-reference-missing',
          attemptCount: 1,
        }),
        updateMany: async () => {
          attemptedUpdate = true;
          return { count: 1 };
        },
      },
    } as any,
    { getRequestContext: () => ({ brandId: 'brand-1', localId: 'local-1' }) } as any,
    { getEffectiveConfig: async () => ({ notificationPrefs: { email: true } }) } as any,
    { dispatchDelivery: async () => { throw new Error('must not dispatch'); } } as any,
  );

  const result = await service.retryForCurrentTenant('delivery-missing-recipient');

  assert.deepEqual(result, { success: false });
  assert.equal(attemptedUpdate, false);
});

test('tenant delivery history rejects permanent SMS failures before changing the outbox row', async () => {
  let attemptedUpdate = false;
  let attemptedDispatch = false;
  const service = new NotificationDeliveryHistoryService(
    {
      notificationDelivery: {
        findFirst: async () => ({
          channel: 'sms',
          status: 'failed',
          lastErrorCode: 'SMS_GATEWAY_AUTH_FAILED',
          activeAttemptReference: 'attempt-reference-auth',
          attemptCount: 5,
        }),
        updateMany: async () => {
          attemptedUpdate = true;
          return { count: 1 };
        },
      },
    } as any,
    { getRequestContext: () => ({ brandId: 'brand-1', localId: 'local-1' }) } as any,
    { getEffectiveConfig: async () => ({ notificationPrefs: { sms: true } }) } as any,
    {
      dispatchDelivery: async () => {
        attemptedDispatch = true;
      },
    } as any,
  );

  const result = await service.retryForCurrentTenant('delivery-auth-failure');

  assert.deepEqual(result, { success: false });
  assert.equal(attemptedUpdate, false);
  assert.equal(attemptedDispatch, false);
});

test('manual retry preserves the critical trace marker for the same delivery incident', async () => {
  let retryData: any = null;
  let retryWhere: any = null;
  let dispatchedId: string | null = null;
  const service = new NotificationDeliveryHistoryService(
    {
      notificationDelivery: {
        findFirst: async () => ({
          channel: 'email',
          status: 'failed',
          lastErrorCode: 'SMTP_TEMPORARY_FAILURE',
          activeAttemptReference: 'attempt-reference-1',
          attemptCount: 5,
        }),
        updateMany: async (params: any) => {
          retryWhere = params.where;
          retryData = params.data;
          return { count: 1 };
        },
      },
    } as any,
    { getRequestContext: () => ({ brandId: 'brand-1', localId: 'local-1' }) } as any,
    { getEffectiveConfig: async () => ({ notificationPrefs: { email: true } }) } as any,
    {
      dispatchDelivery: async (deliveryId: string) => {
        dispatchedId = deliveryId;
        return { status: 'failed', errorCode: 'SMTP_AUTH_FAILED' };
      },
    } as any,
  );

  const result = await service.retryForCurrentTenant('delivery-1');

  assert.equal(result.success, true);
  assert.equal(dispatchedId, 'delivery-1');
  assert.equal(retryWhere.activeAttemptReference, 'attempt-reference-1');
  assert.equal(retryWhere.attemptCount, 5);
  assert.equal(retryWhere.lastErrorCode, 'SMTP_TEMPORARY_FAILURE');
  assert.equal(retryData.activeAttemptReference, null);
  assert.equal(Object.prototype.hasOwnProperty.call(retryData, 'criticalTraceReportedAt'), false);
});
