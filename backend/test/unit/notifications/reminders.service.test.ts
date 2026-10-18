import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { RemindersService } from '@/modules/notifications/reminders.service';

test('reminder scheduler does not query or enqueue routine SMS locally', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  let reminderQueries = 0;
  let queued = 0;
  const service = new RemindersService(
    { getEffectiveConfig: async () => ({ notificationPrefs: { sms: true, whatsapp: false } }) } as any,
    {} as any,
    {} as any,
    {
      findPendingReminders: async () => {
        reminderQueries += 1;
        return [];
      },
    } as any,
    {
      queueReminder: async () => {
        queued += 1;
      },
    } as any,
    { isReadyForRoutineDelivery: () => true } as any,
    { isReadyForRoutineDelivery: () => false } as any,
  );

  try {
    const sent = await (service as any).handleRemindersForLocal();
    assert.equal(sent, 0);
    assert.equal(reminderQueries, 0);
    assert.equal(queued, 0);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('reminder scheduler does not query or enqueue SMS when the global gateway is not ready', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let reminderQueries = 0;
  let queued = 0;
  const service = new RemindersService(
    { getEffectiveConfig: async () => ({ notificationPrefs: { sms: true, whatsapp: false } }) } as any,
    {} as any,
    {} as any,
    {
      findPendingReminders: async () => {
        reminderQueries += 1;
        return [];
      },
    } as any,
    {
      queueReminder: async () => {
        queued += 1;
      },
    } as any,
    { isReadyForRoutineDelivery: () => false } as any,
    { isReadyForRoutineDelivery: () => false } as any,
  );

  try {
    const sent = await (service as any).handleRemindersForLocal();
    assert.equal(sent, 0);
    assert.equal(reminderQueries, 0);
    assert.equal(queued, 0);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('reminder scheduler does not consume a WhatsApp-only reminder when its gateway is not ready', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let reminderQueries = 0;
  let queued = 0;
  const service = new RemindersService(
    { getEffectiveConfig: async () => ({ notificationPrefs: { sms: false, whatsapp: true } }) } as any,
    {} as any,
    {} as any,
    {
      findPendingReminders: async () => {
        reminderQueries += 1;
        return [];
      },
    } as any,
    {
      queueReminder: async () => {
        queued += 1;
      },
    } as any,
    { isReadyForRoutineDelivery: () => false } as any,
    { isReadyForRoutineDelivery: () => false } as any,
  );

  try {
    const sent = await (service as any).handleRemindersForLocal();
    assert.equal(sent, 0);
    assert.equal(reminderQueries, 0);
    assert.equal(queued, 0);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
