import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { GetAvailabilityUseCase } from '@/contexts/booking/application/use-cases/get-availability.use-case';
import { BookingSchedulePolicy } from '@/contexts/booking/domain/value-objects/schedule';

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
  monday: { closed: false, morning: { enabled: true, start: '09:00', end: '12:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
  tuesday: { closed: false, morning: { enabled: true, start: '09:00', end: '12:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
  wednesday: { closed: false, morning: { enabled: true, start: '09:00', end: '12:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
  thursday: { closed: false, morning: { enabled: true, start: '09:00', end: '12:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
  friday: { closed: false, morning: { enabled: true, start: '09:00', end: '12:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
  saturday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
  sunday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
};

const buildUseCase = (params?: { isActive?: boolean; startDate?: Date | null; serviceAllowed?: boolean }) => {
  const isActive = params?.isActive ?? true;
  const startDate = params?.startDate ?? null;
  const serviceAllowed = params?.serviceAllowed ?? true;

  return new GetAvailabilityUseCase(
    {
      listAppointmentsForBarberDay: async () => [],
      listAppointmentsForBarbersDay: async () => [],
      countWeeklyLoad: async () => ({}),
    },
    {
      getShopSchedule: async () => schedule,
      getBarberSchedule: async () => schedule,
      getBarberSchedules: async () => ({ barber1: schedule }),
    },
    {
      getGeneralHolidays: async () => [],
      getBarberHolidays: async () => [],
      getBarberHolidaysByBarberIds: async () => ({}),
    },
    {
      getBarber: async () => ({
        id: 'barber1',
        isActive,
        startDate,
        endDate: null,
      }),
      getBarbers: async () => [],
      isBarberAllowedForService: async () => serviceAllowed,
      getEligibleBarberIdsForService: async () => [],
    },
    {
      getServiceDuration: async () => 30,
    },
  );
};

test('returns empty when barber is inactive', async () => {
  const useCase = buildUseCase({ isActive: false });
  const result = await useCase.execute({
    context: {
      tenantId: 'b1',
      brandId: 'b1',
      localId: 'l1',
      actorUserId: null,
      timezone: 'Europe/Madrid',
      correlationId: 'corr-1',
    },
    barberId: 'barber1',
    date: '2026-03-04',
  });

  assert.deepEqual(result, []);
});

test('returns empty when barber is not eligible for service', async () => {
  const useCase = buildUseCase({ serviceAllowed: false });
  const result = await useCase.execute({
    context: {
      tenantId: 'b1',
      brandId: 'b1',
      localId: 'l1',
      actorUserId: null,
      timezone: 'Europe/Madrid',
      correlationId: 'corr-2',
    },
    barberId: 'barber1',
    date: '2026-03-04',
    serviceId: 'service1',
  });

  assert.deepEqual(result, []);
});

test('returns empty when date is before barber startDate', async () => {
  const useCase = buildUseCase({ startDate: new Date('2026-03-05T00:00:00.000Z') });
  const result = await useCase.execute({
    context: {
      tenantId: 'b1',
      brandId: 'b1',
      localId: 'l1',
      actorUserId: null,
      timezone: 'Europe/Madrid',
      correlationId: 'corr-3',
    },
    barberId: 'barber1',
    date: '2026-03-04',
  });

  assert.deepEqual(result, []);
});

test('forwards appointmentIdToIgnore to availability read port', async () => {
  const calls: Array<{ appointmentIdToIgnore?: string }> = [];

  const useCase = new GetAvailabilityUseCase(
    {
      listAppointmentsForBarberDay: async (params) => {
        calls.push({ appointmentIdToIgnore: params.appointmentIdToIgnore });
        return [];
      },
      listAppointmentsForBarbersDay: async () => [],
      countWeeklyLoad: async () => ({}),
    },
    {
      getShopSchedule: async () => schedule,
      getBarberSchedule: async () => schedule,
      getBarberSchedules: async () => ({ barber1: schedule }),
    },
    {
      getGeneralHolidays: async () => [],
      getBarberHolidays: async () => [],
      getBarberHolidaysByBarberIds: async () => ({}),
    },
    {
      getBarber: async () => ({
        id: 'barber1',
        isActive: true,
        startDate: null,
        endDate: null,
      }),
      getBarbers: async () => [],
      isBarberAllowedForService: async () => true,
      getEligibleBarberIdsForService: async () => [],
    },
    {
      getServiceDuration: async () => 30,
    },
  );

  await useCase.execute({
    context: {
      tenantId: 'b1',
      brandId: 'b1',
      localId: 'l1',
      actorUserId: null,
      timezone: 'Europe/Madrid',
      correlationId: 'corr-4',
    },
    barberId: 'barber1',
    date: '2026-03-04',
    appointmentIdToIgnore: 'appt-123',
  });

  assert.deepEqual(calls, [{ appointmentIdToIgnore: 'appt-123' }]);
});
