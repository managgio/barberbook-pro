import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotificationDeliveryChannel, NotificationDeliveryStatus } from '@prisma/client';
import { NotificationDeliveryOutboxService } from '@/modules/notifications/notification-delivery-outbox.service';
import { NotificationDeliveryAttemptRecorder } from '@/modules/notifications/notification-delivery-attempt-recorder.service';
import { NotificationDeliveryCriticalReporter } from '@/modules/notifications/notification-delivery-critical-reporter.service';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: null,
  timezone: 'Europe/Madrid',
  correlationId: 'corr-1',
};

const buildHarness = (sendResult: any) => {
  let delivery: any = null;
  const attempts: any[] = [];
  const criticalTraces: any[] = [];
  const notificationDelivery = {
    upsert: async (params: any) => {
      if (delivery?.idempotencyKeyHash === params.where.idempotencyKeyHash) return delivery;
      delivery = {
        id: 'delivery-1',
        ...params.create,
        status: NotificationDeliveryStatus.pending,
        attemptCount: 0,
        maxAttempts: 5,
        processingStartedAt: null,
        criticalTraceReportedAt: null,
      };
      return delivery;
    },
    updateMany: async (params: any) => {
      if (!delivery || params.where.id !== delivery.id) return { count: 0 };
      if (params.data.attemptCount?.increment) {
        delivery.attemptCount += params.data.attemptCount.increment;
      }
      Object.assign(delivery, {
        ...params.data,
        attemptCount: delivery.attemptCount,
      });
      return { count: 1 };
    },
    findFirst: async () => delivery,
    update: async (params: any) => {
      Object.assign(delivery, params.data);
      return delivery;
    },
  };
  const prisma: any = {
    notificationDelivery,
    notificationDeliveryAttempt: {
      create: async (params: any) => {
        attempts.push(params.data);
        return params.data;
      },
    },
    $transaction: async (operation: any) => {
      if (typeof operation === 'function') return operation(prisma);
      return Promise.all(operation);
    },
  };
  const observability = {
    recordCriticalTrace: async (...args: any[]) => {
      criticalTraces.push(args);
    },
  } as any;
  const service = new NotificationDeliveryOutboxService(
    prisma,
    {
      sendAppointmentEmail: async () => sendResult,
      sendReferralRewardEmail: async () => sendResult,
      sendBroadcastEmail: async () => sendResult,
      sendBroadcastSms: async () => sendResult,
      sendBroadcastWhatsapp: async () => sendResult,
      sendReminderSms: async () => sendResult,
      sendReminderWhatsapp: async () => sendResult,
    } as any,
    { getRequestContext: () => requestContext } as any,
    new NotificationDeliveryAttemptRecorder(prisma),
    new NotificationDeliveryCriticalReporter(prisma, observability),
  );
  return { service, getDelivery: () => delivery, attempts, criticalTraces };
};

test('email outbox is idempotent and records SMTP acceptance', async () => {
  const harness = buildHarness({ status: 'accepted', providerMessageId: 'smtp-1' });
  const options = {
    appointmentId: 'appointment-1',
    idempotencyKey: 'appointment:appointment-1:created',
    correlationId: 'corr-1',
  };
  const first = await harness.service.enqueueAppointmentEmail(
    { email: 'client@example.com', name: 'Client' },
    { date: new Date('2026-08-30T10:00:00.000Z'), serviceName: 'Corte' },
    'creada',
    options,
  );
  const duplicate = await harness.service.enqueueAppointmentEmail(
    { email: 'client@example.com', name: 'Client' },
    { date: new Date('2026-08-30T10:00:00.000Z'), serviceName: 'Corte' },
    'creada',
    options,
  );

  assert.equal(duplicate.id, first.id);
  const result = await harness.service.dispatchDelivery(first.id);
  assert.equal(result?.status, NotificationDeliveryStatus.accepted);
  assert.equal(harness.getDelivery().providerMessageId, 'smtp-1');
  assert.equal(harness.getDelivery().attemptCount, 1);
  assert.equal(harness.attempts.length, 1);
  assert.equal(harness.criticalTraces.length, 0);
});

test('email outbox promotes only a final exhausted transient failure', async () => {
  const harness = buildHarness({
    status: 'failed',
    code: 'SMTP_TEMPORARY_FAILURE',
    message: 'Temporary SMTP failure.',
    retryable: true,
    critical: false,
  });
  const queued = await harness.service.enqueueBroadcastEmail(
    { contact: { email: 'client@example.com' }, subject: 'Aviso', message: 'Mensaje' },
    { idempotencyKey: 'communication:1:client' },
  );
  harness.getDelivery().maxAttempts = 1;

  const result = await harness.service.dispatchDelivery(queued.id);

  assert.equal(result?.status, NotificationDeliveryStatus.failed);
  assert.equal(harness.getDelivery().lastErrorCode, 'SMTP_TEMPORARY_FAILURE');
  assert.equal(harness.criticalTraces.length, 1);
  assert.equal(harness.criticalTraces[0][0].category, 'notification_delivery');
});

test('notification outbox dispatches SMS through the same durable circuit', async () => {
  const harness = buildHarness({ status: 'accepted', providerMessageId: 'sms-1' });
  const queued = await harness.service.enqueueBroadcastNotification(
    NotificationDeliveryChannel.sms,
    { contact: { phone: '+34123456789' }, message: 'Aviso' },
    { idempotencyKey: 'communication:2:client:sms' },
  );

  const result = await harness.service.dispatchDelivery(queued.id);

  assert.equal(result?.status, NotificationDeliveryStatus.accepted);
  assert.equal(harness.getDelivery().channel, NotificationDeliveryChannel.sms);
  assert.equal(harness.getDelivery().recipientAddress, '+34123456789');
});
