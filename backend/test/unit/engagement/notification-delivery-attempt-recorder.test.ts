import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotificationDeliveryStatus } from '@prisma/client';
import { NotificationDeliveryAttemptRecorder } from '@/modules/notifications/notification-delivery-attempt-recorder.service';

test('provider acceptance never downgrades a delivery callback that arrived first', async () => {
  const updates: any[] = [];
  const attempts: any[] = [];
  const prisma: any = {
    notificationDelivery: {
      updateMany: async (params: any) => {
        updates.push(params);
        return { count: params.where.status === NotificationDeliveryStatus.processing ? 0 : 1 };
      },
    },
    notificationDeliveryAttempt: {
      create: async (params: any) => {
        attempts.push(params.data);
        return params.data;
      },
    },
  };
  prisma.$transaction = async (callback: (tx: any) => Promise<void>) => callback(prisma);
  const recorder = new NotificationDeliveryAttemptRecorder(prisma);

  await recorder.accepted(
    'delivery-1',
    1,
    'attempt-reference-1',
    'SM11111111111111111111111111111111',
    new Date('2026-10-17T10:00:00.000Z'),
  );

  assert.equal(updates.length, 2);
  assert.deepEqual(updates[1].where.status.in, [
    NotificationDeliveryStatus.sent,
    NotificationDeliveryStatus.delivered,
    NotificationDeliveryStatus.undelivered,
  ]);
  assert.equal(updates[1].where.activeAttemptReference, 'attempt-reference-1');
  assert.equal(Object.prototype.hasOwnProperty.call(updates[1].data, 'status'), false);
  assert.equal(attempts.length, 1);
});

const buildTerminalRaceHarness = () => {
  const attempts: any[] = [];
  const delivery: {
    id: string;
    status: NotificationDeliveryStatus;
    attemptCount: number;
    activeAttemptReference: string;
  } = {
    id: 'delivery-1',
    status: NotificationDeliveryStatus.delivered,
    attemptCount: 1,
    activeAttemptReference: 'attempt-reference-1',
  };
  const prisma: any = {
    notificationDelivery: {
      updateMany: async (params: any) => {
        const ownsProcessingAttempt = params.where.id === delivery.id
          && params.where.attemptCount === delivery.attemptCount
          && params.where.activeAttemptReference === delivery.activeAttemptReference
          && params.where.status === NotificationDeliveryStatus.processing
          && delivery.status === NotificationDeliveryStatus.processing;
        if (!ownsProcessingAttempt) return { count: 0 };
        Object.assign(delivery, params.data);
        return { count: 1 };
      },
    },
    notificationDeliveryAttempt: {
      create: async (params: any) => {
        attempts.push(params.data);
        return params.data;
      },
    },
  };
  prisma.$transaction = async (callback: (tx: any) => Promise<boolean>) => callback(prisma);
  return { recorder: new NotificationDeliveryAttemptRecorder(prisma), delivery, attempts };
};

test('an ambiguous SDK failure cannot overwrite a terminal callback from the same attempt', async () => {
  const harness = buildTerminalRaceHarness();
  const recorded = await harness.recorder.failed(
    'delivery-1',
    1,
    'attempt-reference-1',
    {
      status: 'failed',
      code: 'SMS_GATEWAY_TEMPORARY_FAILURE',
      message: 'The provider response was ambiguous.',
      retryable: true,
      critical: false,
    },
    {
      status: 'retrying',
      nextAttemptAt: new Date('2026-10-17T10:05:00.000Z'),
      promoteToCriticalTrace: false,
    },
    new Date('2026-10-17T10:00:00.000Z'),
  );

  assert.equal(recorded, false);
  assert.equal(harness.delivery.status, NotificationDeliveryStatus.delivered);
  assert.equal(harness.attempts.length, 0);
});

test('a skipped result cannot overwrite a terminal callback from the same attempt', async () => {
  const harness = buildTerminalRaceHarness();
  const recorded = await harness.recorder.skipped(
    'delivery-1',
    1,
    'attempt-reference-1',
    'SMS_DISABLED',
    'SMS is disabled.',
    new Date('2026-10-17T10:00:00.000Z'),
  );

  assert.equal(recorded, false);
  assert.equal(harness.delivery.status, NotificationDeliveryStatus.delivered);
  assert.equal(harness.attempts.length, 0);
});
