import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { PrismaHolidayManagementAdapter } from '@/contexts/booking/infrastructure/prisma/prisma-holiday-management.adapter';
import { formatDateInTimeZone } from '@/utils/timezone';

test('holiday impact is tenant and professional scoped and counts guests without email', async () => {
  const queries: Array<Record<string, any>> = [];
  const adapter = new PrismaHolidayManagementAdapter({
    appointment: {
      findMany: async (query: Record<string, any>) => {
        queries.push(query);
        return [
          {
            id: 'appointment-1',
            userId: 'user-1',
            guestContact: null,
            user: { email: 'client@example.test' },
          },
          {
            id: 'appointment-2',
            userId: null,
            guestContact: '+34 600 000 000 · guest@example.test',
            user: null,
          },
          {
            id: 'appointment-3',
            userId: null,
            guestContact: '+34 611 111 111',
            user: null,
          },
        ];
      },
    },
  } as any);

  const result = await adapter.getAppointmentImpact({
    localId: 'local-1',
    timezone: 'Europe/Madrid',
    start: '2026-08-20',
    end: '2026-08-24',
    barberId: 'barber-1',
  });

  assert.equal(queries.length, 1);
  assert.equal(queries[0].where.localId, 'local-1');
  assert.equal(queries[0].where.barberId, 'barber-1');
  assert.equal(queries[0].where.status, 'scheduled');
  assert.equal(
    formatDateInTimeZone(queries[0].where.startDateTime.gte, 'Europe/Madrid'),
    '2026-08-20',
  );
  assert.equal(
    formatDateInTimeZone(queries[0].where.startDateTime.lte, 'Europe/Madrid'),
    '2026-08-24',
  );
  assert.deepEqual(result, {
    appointmentsAffected: 3,
    clientsAffected: 3,
    withoutEmail: 1,
  });
});
