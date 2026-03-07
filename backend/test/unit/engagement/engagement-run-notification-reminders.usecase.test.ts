import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { RunNotificationRemindersUseCase } from '@/contexts/engagement/application/use-cases/run-notification-reminders.use-case';
import { EngagementNotificationManagementPort } from '@/contexts/engagement/ports/outbound/notification-management.port';
import {
  EngagementNotificationReminderPort,
  EngagementPendingReminder,
} from '@/contexts/engagement/ports/outbound/notification-reminder.port';

const baseReminderPort = (reminders: EngagementPendingReminder[]): EngagementNotificationReminderPort => ({
  findPendingReminders: async () => reminders,
  markReminderSent: async () => undefined,
});

const baseNotificationPort = (): EngagementNotificationManagementPort => ({
  sendAppointmentEmail: async () => undefined,
  sendReferralRewardEmail: async () => undefined,
  sendReminderSms: async () => undefined,
  sendTestSms: async () => ({ success: true, sid: 'sms' }),
  sendReminderWhatsapp: async () => undefined,
  sendTestWhatsapp: async () => ({ success: true, sid: 'wa' }),
});

test('run notification reminders short-circuits when channels are disabled', async () => {
  let queried = false;
  const reminderPort: EngagementNotificationReminderPort = {
    findPendingReminders: async () => {
      queried = true;
      return [];
    },
    markReminderSent: async () => undefined,
  };
  const useCase = new RunNotificationRemindersUseCase(reminderPort, baseNotificationPort());

  const result = await useCase.execute({
    windowStart: new Date('2026-03-07T10:00:00.000Z'),
    windowEnd: new Date('2026-03-07T10:10:00.000Z'),
    smsEnabled: false,
    whatsappEnabled: false,
  });

  assert.equal(result, 0);
  assert.equal(queried, false);
});

test('run notification reminders sends enabled channels and marks reminder', async () => {
  const reminders: EngagementPendingReminder[] = [
    {
      appointmentId: 'apt-1',
      allowSms: true,
      allowWhatsapp: true,
      contact: { phone: '+34123456789', name: 'Client' },
      appointment: { date: new Date('2026-03-08T10:00:00.000Z'), serviceName: 'Fade', barberName: 'Alex' },
    },
  ];
  const sent: string[] = [];
  const marked: string[] = [];
  const reminderPort: EngagementNotificationReminderPort = {
    ...baseReminderPort(reminders),
    markReminderSent: async (appointmentId) => {
      marked.push(appointmentId);
    },
  };
  const notificationPort: EngagementNotificationManagementPort = {
    ...baseNotificationPort(),
    sendReminderSms: async () => {
      sent.push('sms');
    },
    sendReminderWhatsapp: async () => {
      sent.push('whatsapp');
    },
  };
  const useCase = new RunNotificationRemindersUseCase(reminderPort, notificationPort);

  const result = await useCase.execute({
    windowStart: new Date('2026-03-07T10:00:00.000Z'),
    windowEnd: new Date('2026-03-07T10:10:00.000Z'),
    smsEnabled: true,
    whatsappEnabled: true,
  });

  assert.equal(result, 1);
  assert.deepEqual(sent, ['sms', 'whatsapp']);
  assert.deepEqual(marked, ['apt-1']);
});

test('run notification reminders skips reminder when contact permissions are disabled', async () => {
  const reminders: EngagementPendingReminder[] = [
    {
      appointmentId: 'apt-2',
      allowSms: false,
      allowWhatsapp: false,
      contact: { phone: '+34123456789', name: 'Client' },
      appointment: { date: new Date('2026-03-08T10:00:00.000Z') },
    },
  ];
  const sent: string[] = [];
  const marked: string[] = [];
  const reminderPort: EngagementNotificationReminderPort = {
    ...baseReminderPort(reminders),
    markReminderSent: async (appointmentId) => {
      marked.push(appointmentId);
    },
  };
  const notificationPort: EngagementNotificationManagementPort = {
    ...baseNotificationPort(),
    sendReminderSms: async () => {
      sent.push('sms');
    },
    sendReminderWhatsapp: async () => {
      sent.push('whatsapp');
    },
  };
  const useCase = new RunNotificationRemindersUseCase(reminderPort, notificationPort);

  const result = await useCase.execute({
    windowStart: new Date('2026-03-07T10:00:00.000Z'),
    windowEnd: new Date('2026-03-07T10:10:00.000Z'),
    smsEnabled: true,
    whatsappEnabled: true,
  });

  assert.equal(result, 0);
  assert.deepEqual(sent, []);
  assert.deepEqual(marked, []);
});
