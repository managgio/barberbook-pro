import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { PrismaBookingAvailabilityReadAdapter } from '@/contexts/booking/infrastructure/prisma/prisma-booking-availability-read.adapter';

test('listAppointmentsForBarberDay applies tenant scope and appointmentIdToIgnore filter', async () => {
  let findManyArgs: any = null;
  const adapter = new PrismaBookingAvailabilityReadAdapter({
    appointment: {
      findMany: async (args: any) => {
        findManyArgs = args;
        return [
          {
            barberId: 'barber-1',
            startDateTime: new Date('2026-03-07T10:00:00.000Z'),
            service: { duration: 45 },
          },
        ];
      },
    },
  } as any);

  const result = await adapter.listAppointmentsForBarberDay({
    localId: 'local-1',
    barberId: 'barber-1',
    dateOnly: '2026-03-07',
    appointmentIdToIgnore: 'appt-123',
  });

  assert.equal(findManyArgs.where.localId, 'local-1');
  assert.equal(findManyArgs.where.barberId, 'barber-1');
  assert.deepEqual(findManyArgs.where.NOT, { id: 'appt-123' });
  assert.deepEqual(findManyArgs.include, { service: { select: { duration: true } } });
  assert.deepEqual(result, [
    {
      barberId: 'barber-1',
      startDateTime: new Date('2026-03-07T10:00:00.000Z'),
      serviceDurationMinutes: 45,
    },
  ]);
});

test('listAppointmentsForBarbersDay scopes by local and barber ids', async () => {
  let findManyArgs: any = null;
  const adapter = new PrismaBookingAvailabilityReadAdapter({
    appointment: {
      findMany: async (args: any) => {
        findManyArgs = args;
        return [];
      },
    },
  } as any);

  await adapter.listAppointmentsForBarbersDay({
    localId: 'local-1',
    barberIds: ['barber-1', 'barber-2'],
    dateOnly: '2026-03-07',
  });

  assert.equal(findManyArgs.where.localId, 'local-1');
  assert.deepEqual(findManyArgs.where.barberId, { in: ['barber-1', 'barber-2'] });
  assert.equal(findManyArgs.where.status.not, 'cancelled');
});

test('countWeeklyLoad deduplicates barber ids and maps grouped counts', async () => {
  let groupByArgs: any = null;
  const adapter = new PrismaBookingAvailabilityReadAdapter({
    appointment: {
      groupBy: async (args: any) => {
        groupByArgs = args;
        return [
          { barberId: 'barber-1', _count: { _all: 3 } },
          { barberId: 'barber-2', _count: { _all: 1 } },
        ];
      },
    },
  } as any);

  const result = await adapter.countWeeklyLoad({
    localId: 'local-1',
    dateFrom: '2026-03-01',
    dateTo: '2026-03-07',
    barberIds: ['barber-1', 'barber-1', 'barber-2'],
  });

  assert.equal(groupByArgs.where.localId, 'local-1');
  assert.deepEqual(groupByArgs.where.barberId, { in: ['barber-1', 'barber-2'] });
  assert.deepEqual(result, { 'barber-1': 3, 'barber-2': 1 });
});
