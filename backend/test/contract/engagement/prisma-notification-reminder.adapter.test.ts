import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaEngagementNotificationReminderAdapter } from '@/modules/notifications/adapters/prisma-engagement-notification-reminder.adapter';

const requestContext = {
  tenantId: 'brand-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: null,
  timezone: 'Europe/Madrid',
  correlationId: 'corr-1',
};

test('notification reminder adapter honors guest channel consent and the multi-service snapshot', async () => {
  let findArgs: any = null;
  const adapter = new PrismaEngagementNotificationReminderAdapter(
    {
      appointment: {
        findMany: async (args: any) => {
          findArgs = args;
          return [
            {
              id: 'appointment-1',
              user: null,
              guestName: 'Invitada',
              guestContact: 'invitada@example.com · +34 600 000 000',
              guestEmail: 'invitada@example.com',
              guestPhone: '+34 600 000 000',
              reminderSmsRequested: true,
              reminderWhatsappRequested: false,
              startDateTime: new Date('2026-10-19T10:00:00.000Z'),
              updatedAt: new Date('2026-10-18T08:15:00.000Z'),
              serviceNameSnapshot: 'Corte + Barba',
              serviceItems: [
                { nameSnapshot: 'Corte' },
                { nameSnapshot: 'Barba' },
              ],
              service: { name: 'Corte' },
              barber: { name: 'Alex' },
              local: {
                brand: { customDomain: 'reservas.example.com', subdomain: 'tenant-one' },
              },
            },
          ];
        },
      },
    } as any,
    { getRequestContext: () => requestContext } as any,
    {
      createManagementUrlForGuestAppointment: () => 'https://reservas.example.com/cita/token',
    } as any,
  );

  const reminders = await adapter.findPendingReminders({
    windowStart: new Date('2026-10-19T09:50:00.000Z'),
    windowEnd: new Date('2026-10-19T10:10:00.000Z'),
  });

  assert.equal(findArgs.where.localId, 'local-1');
  assert.equal(reminders[0]?.allowSms, true);
  assert.equal(reminders[0]?.allowWhatsapp, false);
  assert.equal(reminders[0]?.reminderRevision, '2026-10-18T08:15:00.000Z');
  assert.equal(reminders[0]?.contact.phone, '+34 600 000 000');
  assert.equal(reminders[0]?.appointment.serviceName, 'Corte + Barba');
  assert.equal(reminders[0]?.appointment.managementUrl, 'https://reservas.example.com/cita/token');
});

test('notification reminder adapter keeps registered user preferences authoritative', async () => {
  const adapter = new PrismaEngagementNotificationReminderAdapter(
    {
      appointment: {
        findMany: async () => [
          {
            id: 'appointment-2',
            user: {
              name: 'Cliente',
              email: 'client@example.com',
              phone: '+34600000000',
              notificationSms: false,
              notificationWhatsapp: true,
            },
            guestName: null,
            guestContact: null,
            guestEmail: null,
            guestPhone: null,
            reminderSmsRequested: true,
            reminderWhatsappRequested: false,
            startDateTime: new Date('2026-10-19T10:00:00.000Z'),
            updatedAt: new Date('2026-10-18T08:15:00.000Z'),
            serviceNameSnapshot: null,
            serviceItems: [],
            service: { name: 'Corte' },
            barber: { name: 'Alex' },
            local: {
              brand: { customDomain: null, subdomain: 'tenant-one' },
            },
          },
        ],
      },
    } as any,
    { getRequestContext: () => requestContext } as any,
    { createManagementUrlForGuestAppointment: () => null } as any,
  );

  const reminders = await adapter.findPendingReminders({
    windowStart: new Date('2026-10-19T09:50:00.000Z'),
    windowEnd: new Date('2026-10-19T10:10:00.000Z'),
  });

  assert.equal(reminders[0]?.allowSms, false);
  assert.equal(reminders[0]?.allowWhatsapp, true);
});

test('notification reminder adapter marks appointments within the current tenant only', async () => {
  let updateArgs: any = null;
  const adapter = new PrismaEngagementNotificationReminderAdapter(
    {
      appointment: {
        updateMany: async (args: any) => {
          updateArgs = args;
          return { count: 1 };
        },
      },
    } as any,
    { getRequestContext: () => requestContext } as any,
    { createManagementUrlForGuestAppointment: () => null } as any,
  );

  await adapter.markReminderSent('appointment-1');

  assert.deepEqual(updateArgs.where, {
    id: 'appointment-1',
    localId: 'local-1',
  });
});
