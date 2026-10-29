import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { GetAvailableDaysUseCase } from '@/contexts/booking/application/use-cases/get-available-days.use-case';
import { GetAvailabilityBatchUseCase } from '@/contexts/booking/application/use-cases/get-availability-batch.use-case';
import {
  BookingSchedulePolicy,
  DaySchedule,
} from '@/contexts/booking/domain/value-objects/schedule';
import { DateRange } from '@/contexts/booking/domain/value-objects/date-range';
import { BarberAvailabilitySnapshot } from '@/contexts/booking/ports/outbound/barber-eligibility-read.port';
import {
  BookingAppointmentSlotRecord,
  BookingAvailabilityRange,
  BookingClosureSlotRecord,
} from '@/contexts/booking/ports/outbound/booking-availability-read.port';

const context = {
  tenantId: 'brand-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: null,
  timezone: 'Europe/Madrid',
  correlationId: 'days-test',
};
const open: DaySchedule = {
  closed: false,
  morning: { enabled: true, start: '09:00', end: '10:00' },
  afternoon: { enabled: false, start: '00:00', end: '00:00' },
};
const schedule: BookingSchedulePolicy = {
  monday: open,
  tuesday: open,
  wednesday: open,
  thursday: open,
  friday: open,
  saturday: open,
  sunday: { ...open, closed: true },
};
const query = {
  context,
  dateFrom: '2026-03-02',
  dateTo: '2026-03-08',
  barberIds: ['b1'],
  serviceIds: ['s1'],
  slotIntervalMinutes: 15,
};
const barber = (id: string): BarberAvailabilitySnapshot => ({
  id,
  isActive: true,
  startDate: null,
  endDate: null,
});

const fixture = (
  options: {
    schedule?: BookingSchedulePolicy;
    barbers?: BarberAvailabilitySnapshot[];
    holidays?: DateRange[];
    barberHolidays?: Record<string, DateRange[]>;
    appointments?: BookingAppointmentSlotRecord[];
    closures?: BookingClosureSlotRecord[];
    eligible?: Record<string, string[]>;
    now?: string;
    duration?: number;
  } = {},
) => {
  const ranges: BookingAvailabilityRange[] = [];
  let scheduleReads = 0;
  const availability = {
    listAppointmentsForBarbersRange: async (
      range: BookingAvailabilityRange,
    ) => {
      ranges.push(range);
      return options.appointments || [];
    },
    listClosuresForBarbersRange: async (range: BookingAvailabilityRange) => {
      ranges.push(range);
      return options.closures || [];
    },
    listAppointmentsForBarberDay: async () => [],
    listAppointmentsForBarbersDay: async ({ dateOnly }: { dateOnly: string }) =>
      (options.appointments || []).filter((appointment) =>
        appointment.startDateTime.toISOString().startsWith(dateOnly),
      ),
    listClosuresForBarbersDay: async () => options.closures || [],
    countWeeklyLoad: async () => ({}),
  };
  const schedules = {
    getShopSchedule: async () => {
      scheduleReads++;
      return options.schedule || schedule;
    },
    getBarberSchedule: async () => options.schedule || schedule,
    getBarberSchedules: async () => ({}),
  };
  const holidays = {
    getGeneralHolidays: async () => options.holidays || [],
    getBarberHolidays: async () => [],
    getBarberHolidaysByBarberIds: async () => options.barberHolidays || {},
  };
  const barbers = {
    getBarber: async () => null,
    getBarbers: async () => options.barbers || [barber('b1'), barber('b2')],
    isBarberAllowedForService: async () => true,
    getEligibleBarberIdsForService: async ({
      serviceId,
    }: {
      serviceId: string;
    }) => options.eligible?.[serviceId] || ['b1', 'b2'],
  };
  const services = { getServiceDuration: async () => options.duration ?? 30 };
  const useCase = new GetAvailableDaysUseCase(
    availability,
    schedules,
    holidays,
    barbers,
    services,
    { now: () => new Date(options.now || '2026-03-01T00:00:00Z') },
  );
  return {
    useCase,
    ranges,
    scheduleReads: () => scheduleReads,
    batch: new GetAvailabilityBatchUseCase(
      availability,
      schedules,
      holidays,
      barbers,
      services,
    ),
  };
};

test('available days exclude general holidays and closed weekdays with only two tenant-scoped range reads', async () => {
  const f = fixture({
    holidays: [{ start: '2026-03-03T00:00:00Z', end: '2026-03-04' }],
  });
  assert.deepEqual(
    await f.useCase.execute({ ...query, barberIds: ['b1', 'b1'] }),
    ['2026-03-02', '2026-03-05', '2026-03-06', '2026-03-07'],
  );
  assert.equal(f.scheduleReads(), 1);
  assert.equal(f.ranges.length, 2);
  for (const range of f.ranges)
    assert.deepEqual(range, {
      localId: context.localId,
      timezone: context.timezone,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      barberIds: ['b1'],
    });
});

test('automatic assignment accepts any compatible professional, while manual selection respects their holidays', async () => {
  const f = fixture({
    barberHolidays: { b1: [{ start: query.dateFrom, end: query.dateTo }] },
  });
  assert.deepEqual(await f.useCase.execute(query), []);
  assert.equal(
    (await f.useCase.execute({ ...query, barberIds: ['b1', 'b2'] })).length,
    6,
  );
  assert.deepEqual(
    await f.useCase.execute({ ...query, barberIds: ['other-tenant-barber'] }),
    [],
  );
});

test('fully booked days, real appointment duration, buffers and combined services affect calendar availability', async () => {
  const appointments = [
    {
      barberId: 'b1',
      startDateTime: new Date('2026-03-02T08:00:00Z'),
      serviceDurationMinutes: 60,
    },
  ];
  const f = fixture({ appointments });
  assert.equal((await f.useCase.execute(query)).includes('2026-03-02'), false);
  assert.equal(
    (await f.useCase.execute({ ...query, barberIds: ['b1', 'b2'] })).includes(
      '2026-03-02',
    ),
    true,
  );
  assert.equal(
    (await f.useCase.execute({ ...query, serviceIds: ['s1', 's2'] })).length,
    5,
  );
  assert.deepEqual(
    await f.useCase.execute({ ...query, serviceIds: ['s1', 's2', 's3'] }),
    [],
  );
  const buffered = fixture({ schedule: { ...schedule, bufferMinutes: 1 } });
  assert.deepEqual(
    await buffered.useCase.execute({ ...query, serviceIds: ['s1', 's2'] }),
    [],
  );
});

test('general and professional closures span dates and preserve partial-day free time', async () => {
  const f = fixture({
    closures: [
      {
        barberId: null,
        startDateTime: new Date('2026-03-02T00:00:00Z'),
        endDateTime: new Date('2026-03-03T23:00:00Z'),
      },
      {
        barberId: 'b1',
        startDateTime: new Date('2026-03-04T08:00:00Z'),
        endDateTime: new Date('2026-03-04T09:00:00Z'),
      },
      {
        barberId: null,
        startDateTime: new Date('2026-03-05T08:00:00Z'),
        endDateTime: new Date('2026-03-05T08:30:00Z'),
      },
    ],
  });
  assert.deepEqual(await f.useCase.execute(query), [
    '2026-03-05',
    '2026-03-06',
    '2026-03-07',
  ]);
  assert.equal(
    (await f.useCase.execute({ ...query, barberIds: ['b1', 'b2'] })).includes(
      '2026-03-04',
    ),
    true,
  );
});

test('employment dates, inactive professionals and compatibility with every selected service are enforced', async () => {
  const f = fixture({
    barbers: [
      {
        ...barber('b1'),
        startDate: new Date('2026-03-04Z'),
        endDate: new Date('2026-03-05Z'),
      },
      { ...barber('b2'), isActive: false },
    ],
  });
  assert.deepEqual(
    await f.useCase.execute({ ...query, barberIds: ['b1', 'b2'] }),
    ['2026-03-04', '2026-03-05'],
  );
  const incompatible = fixture({ eligible: { s1: ['b1'], s2: ['b2'] } });
  assert.deepEqual(
    await incompatible.useCase.execute({
      ...query,
      barberIds: ['b1', 'b2'],
      serviceIds: ['s1', 's2'],
    }),
    [],
  );
});

test('extraordinary openings, dated breaks and end overflow reuse the daily engine', async () => {
  const custom = {
    ...schedule,
    extraordinaryOpenings: {
      '2026-03-08': {
        allProfessionals: true,
        barberIds: [],
        morning: open.morning,
        afternoon: open.afternoon,
      },
    },
    breaksByDate: { '2026-03-02': [{ start: '09:00', end: '10:00' }] },
    endOverflowMinutes: 30,
  };
  const f = fixture({ schedule: custom, duration: 90 });
  assert.deepEqual(await f.useCase.execute(query), [
    '2026-03-03',
    '2026-03-04',
    '2026-03-05',
    '2026-03-06',
    '2026-03-07',
    '2026-03-08',
  ]);
  const holiday = fixture({
    schedule: custom,
    holidays: [{ start: '2026-03-08', end: '2026-03-08' }],
  });
  assert.equal(
    (await holiday.useCase.execute(query)).includes('2026-03-08'),
    false,
  );
});

test('today is disabled when all remaining slots are in the past using the business timezone', async () => {
  const f = fixture({ now: '2026-03-04T08:31:00Z' });
  assert.deepEqual(await f.useCase.execute(query), [
    '2026-03-05',
    '2026-03-06',
    '2026-03-07',
  ]);
  const earlier = fixture({ now: '2026-03-04T08:29:00Z' });
  assert.equal(
    (await earlier.useCase.execute(query)).includes('2026-03-04'),
    true,
  );
});

test('calendar iteration keeps civil dates through DST and across month boundaries', async () => {
  const f = fixture({
    schedule: { ...schedule, sunday: open },
    now: '2026-03-28T23:30:00Z',
  });
  assert.deepEqual(
    await f.useCase.execute({
      ...query,
      dateFrom: '2026-03-28',
      dateTo: '2026-04-01',
    }),
    ['2026-03-29', '2026-03-30', '2026-03-31', '2026-04-01'],
  );
});

test('monthly availability matches the existing daily batch calculation', async () => {
  const f = fixture({
    barberHolidays: { b1: [{ start: '2026-03-03', end: '2026-03-04' }] },
    holidays: [{ start: '2026-03-06', end: '2026-03-06' }],
    appointments: [
      {
        barberId: 'b1',
        startDateTime: new Date('2026-03-02T08:00:00Z'),
        serviceDurationMinutes: 60,
      },
    ],
  });
  for (const barberIds of [['b1'], ['b1', 'b2']]) {
    const expected: string[] = [];
    for (let day = 2; day <= 8; day++) {
      const date = `2026-03-0${day}`;
      const daily = await f.batch.execute({
        context,
        date,
        barberIds,
        serviceIds: ['s1'],
      });
      if (Object.values(daily).some((slots) => slots.length > 0))
        expected.push(date);
    }
    assert.deepEqual(
      await f.useCase.execute({ ...query, barberIds }),
      expected,
    );
  }
});

test('missing professionals or services skip all reads and operational failures propagate', async () => {
  const f = fixture();
  assert.deepEqual(await f.useCase.execute({ ...query, barberIds: [] }), []);
  assert.deepEqual(await f.useCase.execute({ ...query, serviceIds: [] }), []);
  assert.equal(f.ranges.length, 0);
  const failure = fixture();
  failure.useCase['availabilityReadPort'].listClosuresForBarbersRange =
    async () => {
      throw new Error('DB unavailable');
    };
  await assert.rejects(() => failure.useCase.execute(query), /DB unavailable/);
});
