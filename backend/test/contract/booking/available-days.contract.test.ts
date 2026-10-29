import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { AppointmentsController } from '@/modules/appointments/appointments.controller';
import { AppointmentsFacade } from '@/modules/appointments/appointments.facade';
import { PrismaBookingAvailabilityReadAdapter } from '@/contexts/booking/infrastructure/prisma/prisma-booking-availability-read.adapter';
import { startOfDayInTimeZone, endOfDayInTimeZone } from '@/utils/timezone';

const range = {
  localId: 'local-2',
  barberIds: ['b1', 'b2'],
  dateFrom: '2026-03-28',
  dateTo: '2026-04-02',
  timezone: 'Europe/Madrid',
};

test('range adapter reads only requested tenant and professionals, excludes cancellations and uses real duration', async () => {
  let args: any;
  const adapter = new PrismaBookingAvailabilityReadAdapter({
    appointment: {
      findMany: async (input: any) => {
        args = input;
        return [
          {
            barberId: 'b1',
            startDateTime: new Date('2026-03-29T07:00:00Z'),
            totalDurationMinutes: 90,
            service: { duration: 30 },
          },
        ];
      },
    },
  } as any);
  const result = await adapter.listAppointmentsForBarbersRange(range);
  assert.deepEqual(args.where, {
    localId: 'local-2',
    barberId: { in: ['b1', 'b2'] },
    status: { not: 'cancelled' },
    startDateTime: {
      gte: startOfDayInTimeZone(range.dateFrom, range.timezone),
      lte: endOfDayInTimeZone(range.dateTo, range.timezone),
    },
  });
  assert.deepEqual(Object.keys(args.select).sort(), [
    'barberId',
    'service',
    'startDateTime',
    'totalDurationMinutes',
  ]);
  assert.equal(result[0].serviceDurationMinutes, 90);
  assert.equal(
    args.where.startDateTime.gte.toISOString(),
    '2026-03-27T23:00:00.000Z',
  );
  assert.equal(
    args.where.startDateTime.lte.toISOString(),
    '2026-04-02T21:59:59.999Z',
  );
});

test('range adapter includes overlapping general closures and only requested professionals within the tenant', async () => {
  let args: any;
  const adapter = new PrismaBookingAvailabilityReadAdapter({
    bookingClosure: {
      findMany: async (input: any) => {
        args = input;
        return [];
      },
    },
  } as any);
  await adapter.listClosuresForBarbersRange(range);
  assert.deepEqual(args.where, {
    localId: 'local-2',
    OR: [{ barberId: null }, { barberId: { in: ['b1', 'b2'] } }],
    startDateTime: { lte: endOfDayInTimeZone(range.dateTo, range.timezone) },
    endDateTime: { gt: startOfDayInTimeZone(range.dateFrom, range.timezone) },
  });
});

test('public calendar endpoint requires bounded, valid civil dates, professionals and services', async () => {
  const calls: unknown[][] = [];
  const controller = new AppointmentsController(
    {
      getAvailableDays: async (...args: unknown[]) => {
        calls.push(args);
        return { availableDays: ['2026-03-30'] };
      },
    } as any,
    {} as any,
    {} as any,
    {} as any,
  );
  for (const [from, to, barbers, services] of [
    [undefined, '2026-03-30', 'b1', 's1'],
    ['2026-03-30', undefined, 'b1', 's1'],
    ['2026-02-30', '2026-03-05', 'b1', 's1'],
    ['2026-13-01', '2026-13-05', 'b1', 's1'],
    ['2026-03-30T00:00:00Z', '2026-04-01', 'b1', 's1'],
    ['2026-04-01', '2026-03-30', 'b1', 's1'],
    ['2026-03-01', '2026-04-12', 'b1', 's1'],
    ['2026-03-01', '2026-03-31', '', 's1'],
    ['2026-03-01', '2026-03-31', 'b1', ''],
    [
      '2026-03-01',
      '2026-03-31',
      Array.from({ length: 81 }, (_, index) => `b${index}`).join(','),
      's1',
    ],
    ['2026-03-01', '2026-03-31', 'b1', 's1,s2,s3,s4,s5,s6,s7'],
  ])
    assert.throws(
      () => controller.getAvailableDays(from, to, barbers, services),
      BadRequestException,
    );
  assert.equal(calls.length, 0);
  assert.deepEqual(
    await controller.getAvailableDays(
      '2026-03-01',
      '2026-04-11',
      ' b1,b1,b2 ',
      's1,s1,s2',
    ),
    { availableDays: ['2026-03-30'] },
  );
  assert.deepEqual(calls[0], [
    '2026-03-01',
    '2026-04-11',
    ['b1', 'b2'],
    ['s1', 's2'],
  ]);
});

const facadeFixture = (platformEnabled = true, tenantEnabled = true) => {
  const calls: any[] = [];
  const tenantContext = {
    localId: 'resolved-local',
    brandId: 'resolved-brand',
    timezone: 'Europe/Madrid',
  };
  const args: any[] = Array.from({ length: 17 }, () => ({}));
  args[2] = {
    execute: async (query: any) => {
      calls.push(query);
      return ['2026-03-30'];
    },
  };
  args[14] = {
    getSettings: async () => ({
      appointments: {
        multiServiceEnabled: tenantEnabled,
        slotIntervalMinutes: 30,
      },
    }),
  };
  args[15] = {
    getBrandConfig: async () => ({
      features: { multiServiceBookingEnabled: platformEnabled },
    }),
  };
  args[16] = { getRequestContext: () => tenantContext };
  const facade = new AppointmentsFacade(
    ...(args as ConstructorParameters<typeof AppointmentsFacade>),
  );
  return { facade, calls, tenantContext };
};

test('calendar facade derives the local from request context and preserves multi-service and interval settings', async () => {
  const { facade, calls, tenantContext } = facadeFixture();
  assert.deepEqual(
    await facade.getAvailableDays(
      '2026-03-01',
      '2026-03-31',
      ['b1'],
      ['s1', 's2'],
    ),
    { availableDays: ['2026-03-30'] },
  );
  assert.deepEqual(calls[0], {
    context: tenantContext,
    dateFrom: '2026-03-01',
    dateTo: '2026-03-31',
    barberIds: ['b1'],
    serviceIds: ['s1', 's2'],
    slotIntervalMinutes: 30,
  });
});

test('calendar facade cannot bypass either multi-service capability flag', async () => {
  for (const [platform, tenant] of [
    [false, true],
    [true, false],
  ]) {
    const { facade, calls } = facadeFixture(platform, tenant);
    await assert.rejects(
      () =>
        facade.getAvailableDays(
          '2026-03-01',
          '2026-03-31',
          ['b1'],
          ['s1', 's2'],
        ),
      BadRequestException,
    );
    assert.equal(calls.length, 0);
    assert.deepEqual(
      await facade.getAvailableDays('2026-03-01', '2026-03-31', ['b1'], ['s1']),
      { availableDays: ['2026-03-30'] },
    );
  }
});
