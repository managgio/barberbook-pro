import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { GetAvailabilityBatchUseCase } from '@/contexts/booking/application/use-cases/get-availability-batch.use-case';
import { BookingSchedulePolicy } from '@/contexts/booking/domain/value-objects/schedule';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: null,
  timezone: 'Europe/Madrid',
  correlationId: 'corr-availability-batch-1',
};

const schedule: BookingSchedulePolicy = {
  bufferMinutes: 0,
  endOverflowMinutes: 0,
  endOverflowByDay: {},
  endOverflowByDate: {},
  breaks: {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  },
  breaksByDate: {},
  monday: {
    closed: false,
    morning: { enabled: true, start: '09:00', end: '12:00' },
    afternoon: { enabled: false, start: '00:00', end: '00:00' },
  },
  tuesday: {
    closed: false,
    morning: { enabled: true, start: '09:00', end: '12:00' },
    afternoon: { enabled: false, start: '00:00', end: '00:00' },
  },
  wednesday: {
    closed: false,
    morning: { enabled: true, start: '09:00', end: '12:00' },
    afternoon: { enabled: false, start: '00:00', end: '00:00' },
  },
  thursday: {
    closed: false,
    morning: { enabled: true, start: '09:00', end: '12:00' },
    afternoon: { enabled: false, start: '00:00', end: '00:00' },
  },
  friday: {
    closed: false,
    morning: { enabled: true, start: '09:00', end: '12:00' },
    afternoon: { enabled: false, start: '00:00', end: '00:00' },
  },
  saturday: {
    closed: true,
    morning: { enabled: false, start: '00:00', end: '00:00' },
    afternoon: { enabled: false, start: '00:00', end: '00:00' },
  },
  sunday: {
    closed: true,
    morning: { enabled: false, start: '00:00', end: '00:00' },
    afternoon: { enabled: false, start: '00:00', end: '00:00' },
  },
};

test('get availability batch short-circuits when barber ids are empty after normalization', async () => {
  const useCase = new GetAvailabilityBatchUseCase(
    {
      listAppointmentsForBarberDay: async () => {
        throw new Error('should not be called');
      },
      listAppointmentsForBarbersDay: async () => {
        throw new Error('should not be called');
      },
      countWeeklyLoad: async () => ({}),
    },
    {
      getShopSchedule: async () => {
        throw new Error('should not be called');
      },
      getBarberSchedule: async () => {
        throw new Error('should not be called');
      },
      getBarberSchedules: async () => {
        throw new Error('should not be called');
      },
    },
    {
      getGeneralHolidays: async () => {
        throw new Error('should not be called');
      },
      getBarberHolidays: async () => {
        throw new Error('should not be called');
      },
      getBarberHolidaysByBarberIds: async () => {
        throw new Error('should not be called');
      },
    },
    {
      getBarber: async () => null,
      getBarbers: async () => {
        throw new Error('should not be called');
      },
      isBarberAllowedForService: async () => true,
      getEligibleBarberIdsForService: async () => {
        throw new Error('should not be called');
      },
    },
    {
      getServiceDuration: async () => {
        throw new Error('should not be called');
      },
    },
  );

  const result = await useCase.execute({
    context: requestContext,
    date: '2026-03-04',
    barberIds: ['', ''],
  });

  assert.deepEqual(result, {});
});

test('get availability batch blocks all barbers on general holiday and deduplicates ids in read ports', async () => {
  const received: {
    barberIds?: string[];
    appointmentIdToIgnore?: string;
  } = {};

  const useCase = new GetAvailabilityBatchUseCase(
    {
      listAppointmentsForBarberDay: async () => [],
      listAppointmentsForBarbersDay: async (params) => {
        received.barberIds = params.barberIds;
        received.appointmentIdToIgnore = params.appointmentIdToIgnore;
        return [];
      },
      countWeeklyLoad: async () => ({}),
    },
    {
      getShopSchedule: async () => schedule,
      getBarberSchedule: async () => schedule,
      getBarberSchedules: async () => ({ b1: schedule, b2: schedule }),
    },
    {
      getGeneralHolidays: async () => [{ start: '2026-03-04', end: '2026-03-04' }],
      getBarberHolidays: async () => [],
      getBarberHolidaysByBarberIds: async () => ({ b1: [], b2: [] }),
    },
    {
      getBarber: async () => null,
      getBarbers: async () => [],
      isBarberAllowedForService: async () => true,
      getEligibleBarberIdsForService: async () => ['b1', 'b2'],
    },
    {
      getServiceDuration: async () => 30,
    },
  );

  const result = await useCase.execute({
    context: requestContext,
    date: '2026-03-04',
    barberIds: ['b1', 'b1', 'b2'],
    serviceId: 'service-1',
    appointmentIdToIgnore: 'appt-777',
  });

  assert.deepEqual(result, { b1: [], b2: [] });
  assert.deepEqual(received, {
    barberIds: ['b1', 'b2'],
    appointmentIdToIgnore: 'appt-777',
  });
});

test('get availability batch returns slots only for active, eligible and non-holiday barbers', async () => {
  const calls: { eligible?: { barberIds: string[]; serviceId: string } } = {};
  const useCase = new GetAvailabilityBatchUseCase(
    {
      listAppointmentsForBarberDay: async () => [],
      listAppointmentsForBarbersDay: async () => [
        {
          barberId: 'b1',
          startDateTime: new Date('2026-03-04T08:00:00.000Z'),
          serviceDurationMinutes: 30,
        },
      ],
      countWeeklyLoad: async () => ({}),
    },
    {
      getShopSchedule: async () => schedule,
      getBarberSchedule: async () => schedule,
      getBarberSchedules: async () => ({ b1: schedule, b4: schedule }),
    },
    {
      getGeneralHolidays: async () => [],
      getBarberHolidays: async () => [],
      getBarberHolidaysByBarberIds: async () => ({
        b1: [],
        b2: [],
        b3: [],
        b4: [{ start: '2026-03-04', end: '2026-03-04' }],
        b5: [],
      }),
    },
    {
      getBarber: async () => null,
      getBarbers: async () => [
        { id: 'b1', isActive: true, startDate: null, endDate: null },
        { id: 'b2', isActive: false, startDate: null, endDate: null },
        { id: 'b3', isActive: true, startDate: new Date('2026-03-05T00:00:00.000Z'), endDate: null },
        { id: 'b4', isActive: true, startDate: null, endDate: null },
        { id: 'b5', isActive: true, startDate: null, endDate: null },
      ],
      isBarberAllowedForService: async () => true,
      getEligibleBarberIdsForService: async (params) => {
        calls.eligible = { barberIds: params.barberIds, serviceId: params.serviceId };
        return ['b1', 'b4'];
      },
    },
    {
      getServiceDuration: async () => 30,
    },
  );

  const result = await useCase.execute({
    context: requestContext,
    date: '2026-03-04',
    barberIds: ['b1', 'b2', 'b3', 'b4', 'b5'],
    serviceId: 'service-critical',
  });

  assert.deepEqual(calls.eligible, {
    barberIds: ['b1', 'b2', 'b3', 'b4', 'b5'],
    serviceId: 'service-critical',
  });
  assert.equal(result.b1.includes('09:00'), false);
  assert.equal(result.b1.includes('09:30'), true);
  assert.deepEqual(result.b2, []);
  assert.deepEqual(result.b3, []);
  assert.deepEqual(result.b4, []);
  assert.deepEqual(result.b5, []);
});

test('get availability batch respects custom slot interval from query', async () => {
  const useCase = new GetAvailabilityBatchUseCase(
    {
      listAppointmentsForBarberDay: async () => [],
      listAppointmentsForBarbersDay: async () => [],
      countWeeklyLoad: async () => ({}),
    },
    {
      getShopSchedule: async () => schedule,
      getBarberSchedule: async () => schedule,
      getBarberSchedules: async () => ({ b1: schedule }),
    },
    {
      getGeneralHolidays: async () => [],
      getBarberHolidays: async () => [],
      getBarberHolidaysByBarberIds: async () => ({ b1: [] }),
    },
    {
      getBarber: async () => null,
      getBarbers: async () => [{ id: 'b1', isActive: true, startDate: null, endDate: null }],
      isBarberAllowedForService: async () => true,
      getEligibleBarberIdsForService: async () => ['b1'],
    },
    {
      getServiceDuration: async () => 30,
    },
  );

  const result = await useCase.execute({
    context: requestContext,
    date: '2026-03-04',
    barberIds: ['b1'],
    slotIntervalMinutes: 30,
  });

  assert.equal(result.b1.includes('09:00'), true);
  assert.equal(result.b1.includes('09:30'), true);
  assert.equal(result.b1.includes('09:15'), false);
});
