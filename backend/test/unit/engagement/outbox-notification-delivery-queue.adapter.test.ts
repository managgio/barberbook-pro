import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { OutboxNotificationDeliveryQueueAdapter } from '@/modules/notifications/adapters/outbox-notification-delivery-queue.adapter';

test('reminder delivery idempotency follows the appointment schedule revision', async () => {
  const deliveriesByKey = new Map<string, { id: string }>();
  const dispatched: string[] = [];
  const outbox = {
    enqueueReminder: async (_channel: string, _contact: unknown, _appointment: unknown, options: any) => {
      const idempotencyKey = options.idempotencyKey as string;
      const existing = deliveriesByKey.get(idempotencyKey);
      if (existing) return existing;
      const delivery = { id: `delivery-${deliveriesByKey.size + 1}` };
      deliveriesByKey.set(idempotencyKey, delivery);
      return delivery;
    },
    dispatchDelivery: async (deliveryId: string) => {
      dispatched.push(deliveryId);
    },
  };
  const adapter = new OutboxNotificationDeliveryQueueAdapter(outbox as any);
  const baseReminder = {
    channel: 'sms' as const,
    appointmentId: 'appointment-1',
    reminderRevision: '2026-10-18T08:15:00.000Z',
    contact: { phone: '+34600000000', name: 'Cliente' },
    appointment: {
      date: new Date('2026-10-19T10:00:00.000Z'),
      serviceName: 'Corte',
    },
  };

  await adapter.queueReminder(baseReminder);
  await adapter.queueReminder(baseReminder);
  await adapter.queueReminder({
    ...baseReminder,
    reminderRevision: '2026-10-18T09:30:00.000Z',
    appointment: {
      ...baseReminder.appointment,
      date: new Date('2026-10-19T11:00:00.000Z'),
    },
  });

  assert.equal(deliveriesByKey.size, 2);
  assert.deepEqual(dispatched, ['delivery-1', 'delivery-1', 'delivery-2']);
  assert.deepEqual([...deliveriesByKey.keys()], [
    'appointment:appointment-1:reminder:sms:2026-10-19T10:00:00.000Z:2026-10-18T08:15:00.000Z',
    'appointment:appointment-1:reminder:sms:2026-10-19T11:00:00.000Z:2026-10-18T09:30:00.000Z',
  ]);
});

test('a new appointment revision remains unique even when it returns to the same start time', async () => {
  const keys: string[] = [];
  const adapter = new OutboxNotificationDeliveryQueueAdapter({
    enqueueReminder: async (_channel: string, _contact: unknown, _appointment: unknown, options: any) => {
      keys.push(options.idempotencyKey);
      return { id: `delivery-${keys.length}` };
    },
    dispatchDelivery: async () => undefined,
  } as any);
  const reminder = {
    channel: 'whatsapp' as const,
    appointmentId: 'appointment-1',
    contact: { phone: '+34600000000' },
    appointment: { date: new Date('2026-10-19T10:00:00.000Z') },
  };

  await adapter.queueReminder({
    ...reminder,
    reminderRevision: '2026-10-18T08:15:00.000Z',
  });
  await adapter.queueReminder({
    ...reminder,
    reminderRevision: '2026-10-18T10:45:00.000Z',
  });

  assert.equal(keys.length, 2);
  assert.notEqual(keys[0], keys[1]);
});
