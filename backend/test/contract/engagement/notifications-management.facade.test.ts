import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { EngagementNotificationManagementPort } from '@/contexts/engagement/ports/outbound/notification-management.port';

const basePort = (): EngagementNotificationManagementPort => ({
  sendAppointmentEmail: async () => ({ status: 'accepted' }),
  sendReferralRewardEmail: async () => ({ status: 'accepted' }),
  sendBroadcastEmail: async () => ({ status: 'accepted' }),
  sendBroadcastSms: async () => ({ status: 'accepted' }),
  sendBroadcastWhatsapp: async () => ({ status: 'accepted' }),
  sendReminderSms: async () => ({ status: 'accepted' }),
  sendTestSms: async () => ({ success: true, sid: 'SM_BASE' }),
  sendReminderWhatsapp: async () => ({ status: 'accepted' }),
  sendTestWhatsapp: async () => ({ success: true, sid: 'WA_BASE' }),
});

test('notifications facade delegates appointment email dispatch', async () => {
  const calls: Array<{ action: string; email: string | null | undefined }> = [];
  const service = new NotificationsService(
    basePort(),
    {
      enqueueAppointmentEmail: async (contact: any, _appointment: any, action: string) => {
        calls.push({ action, email: contact.email });
        return { id: 'delivery-1' };
      },
      dispatchDelivery: async () => ({ status: 'accepted' }),
    } as any,
    {} as any,
  );

  await service.sendAppointmentEmail(
    { email: 'client@example.com', name: 'Client' },
    { date: new Date('2026-03-05T10:00:00.000Z'), serviceName: 'Corte' },
    'creada',
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, 'creada');
  assert.equal(calls[0].email, 'client@example.com');
});

test('notifications facade delegates test sms dispatch', async () => {
  const calls: Array<{ phone: string; message: string | null | undefined }> = [];
  const service = new NotificationsService(
    {
      ...basePort(),
      sendTestSms: async (phone, message) => {
        calls.push({ phone, message });
        return { success: true, sid: 'SM_123' };
      },
    },
    {} as any,
    {} as any,
  );

  const result = await service.sendTestSms('+34600111222', 'hola');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].phone, '+34600111222');
  assert.equal(calls[0].message, 'hola');
  assert.equal(result.sid, 'SM_123');
});
