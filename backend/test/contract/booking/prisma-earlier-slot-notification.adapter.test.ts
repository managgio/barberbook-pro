import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { PrismaEarlierSlotNotificationAdapter } from '@/modules/appointments/adapters/prisma-earlier-slot-notification.adapter';

const context = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: null,
  timezone: 'Europe/Madrid',
  correlationId: 'corr-1',
};

test('earlier-slot adapter scopes candidates, claims one atomically and sends the email', async () => {
  const candidateQueries: any[] = [];
  const claimQueries: any[] = [];
  const emails: any[] = [];
  const adapter = new PrismaEarlierSlotNotificationAdapter(
    {
      appointment: {
        findMany: async (query: any) => {
          candidateQueries.push(query);
          return [
            {
              id: 'appointment-target',
              serviceId: 'service-1',
              startDateTime: new Date('2026-08-22T08:00:00.000Z'),
              guestName: null,
              guestContact: null,
              user: { name: 'Ana', email: 'ana@example.test' },
            },
          ];
        },
        updateMany: async (query: any) => {
          claimQueries.push(query);
          return { count: 1 };
        },
      },
    } as any,
    { execute: async () => ['10:00'] } as any,
    {
      sendBroadcastEmail: async (payload: any) => {
        emails.push(payload);
      },
    } as any,
    {
      getSettings: async () => ({ appointments: { slotIntervalMinutes: 15 } }),
    } as any,
    { now: () => new Date('2026-08-19T08:00:00.000Z') },
  );

  const result = await adapter.notifyFirstEligibleRequest({
    context,
    releasedAppointmentId: 'appointment-released',
    barberId: 'barber-1',
    releasedStartDateTime: new Date('2026-08-20T08:00:00.000Z'),
  });

  assert.equal(result, true);
  assert.equal(candidateQueries[0].where.localId, 'local-1');
  assert.equal(candidateQueries[0].where.barberId, 'barber-1');
  assert.equal(candidateQueries[0].where.earlierSlotRequested, true);
  assert.equal(candidateQueries[0].take, 50);
  assert.equal(claimQueries.length, 1);
  assert.equal(claimQueries[0].where.localId, 'local-1');
  assert.equal(claimQueries[0].where.earlierSlotNotifiedAt, null);
  assert.equal(claimQueries[0].data.earlierSlotCandidateAt.toISOString(), '2026-08-20T08:00:00.000Z');
  assert.equal(emails.length, 1);
  assert.equal(emails[0].contact.email, 'ana@example.test');
  assert.match(emails[0].message, /no queda reservado automáticamente/i);
});
