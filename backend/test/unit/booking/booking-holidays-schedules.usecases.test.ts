import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { AddBarberHolidayUseCase } from '@/contexts/booking/application/use-cases/add-barber-holiday.use-case';
import { AddGeneralHolidayUseCase } from '@/contexts/booking/application/use-cases/add-general-holiday.use-case';
import { GetBarberHolidaysUseCase } from '@/contexts/booking/application/use-cases/get-barber-holidays.use-case';
import { RemoveBarberHolidayUseCase } from '@/contexts/booking/application/use-cases/remove-barber-holiday.use-case';
import { RemoveGeneralHolidayUseCase } from '@/contexts/booking/application/use-cases/remove-general-holiday.use-case';
import { GetBarberScheduleUseCase } from '@/contexts/booking/application/use-cases/get-barber-schedule.use-case';
import { GetGeneralHolidaysUseCase } from '@/contexts/booking/application/use-cases/get-general-holidays.use-case';
import { GetShopScheduleUseCase } from '@/contexts/booking/application/use-cases/get-shop-schedule.use-case';
import { GetWeeklyLoadUseCase } from '@/contexts/booking/application/use-cases/get-weekly-load.use-case';
import { UpdateBarberScheduleUseCase } from '@/contexts/booking/application/use-cases/update-barber-schedule.use-case';
import { UpdateShopScheduleUseCase } from '@/contexts/booking/application/use-cases/update-shop-schedule.use-case';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: 'admin-1',
  timezone: 'Europe/Madrid',
  correlationId: 'corr-booking-holidays-schedules-1',
};

test('add general holiday use case normalizes reversed range before persistence', async () => {
  const calls: Array<{ type: string; payload: unknown }> = [];
  const useCase = new AddGeneralHolidayUseCase({
    getGeneralHolidays: async (params) => {
      calls.push({ type: 'getGeneralHolidays', payload: params });
      return [{ start: '2026-03-04', end: '2026-03-10' }];
    },
    addGeneralHolidayIfMissing: async (params) => {
      calls.push({ type: 'addGeneralHolidayIfMissing', payload: params });
    },
    removeGeneralHoliday: async () => undefined,
    getBarberHolidays: async () => [],
    addBarberHolidayIfMissing: async () => undefined,
    removeBarberHoliday: async () => undefined,
  });

  const result = await useCase.execute({
    context: requestContext,
    range: {
      start: '2026-03-10',
      end: '2026-03-04',
    },
  });

  assert.deepEqual(calls, [
    {
      type: 'addGeneralHolidayIfMissing',
      payload: { localId: 'local-1', start: '2026-03-04', end: '2026-03-10' },
    },
    {
      type: 'getGeneralHolidays',
      payload: { localId: 'local-1' },
    },
  ]);
  assert.deepEqual(result, [{ start: '2026-03-04', end: '2026-03-10' }]);
});

test('remove barber holiday use case normalizes range and returns updated barber holidays', async () => {
  const calls: Array<{ type: string; payload: unknown }> = [];
  const useCase = new RemoveBarberHolidayUseCase({
    getGeneralHolidays: async () => [],
    addGeneralHolidayIfMissing: async () => undefined,
    removeGeneralHoliday: async () => undefined,
    getBarberHolidays: async (params) => {
      calls.push({ type: 'getBarberHolidays', payload: params });
      return [];
    },
    addBarberHolidayIfMissing: async () => undefined,
    removeBarberHoliday: async (params) => {
      calls.push({ type: 'removeBarberHoliday', payload: params });
    },
  });

  await useCase.execute({
    context: requestContext,
    barberId: 'barber-1',
    range: {
      start: '2026-04-20',
      end: '2026-04-10',
    },
  });

  assert.deepEqual(calls, [
    {
      type: 'removeBarberHoliday',
      payload: {
        localId: 'local-1',
        barberId: 'barber-1',
        start: '2026-04-10',
        end: '2026-04-20',
      },
    },
    {
      type: 'getBarberHolidays',
      payload: {
        localId: 'local-1',
        barberId: 'barber-1',
      },
    },
  ]);
});

test('update shop schedule use case forwards localId and schedule to management port', async () => {
  const received: { payload?: unknown } = {};
  const useCase = new UpdateShopScheduleUseCase({
    getShopSchedule: async () => ({
      monday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
      tuesday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
      wednesday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
      thursday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
      friday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
      saturday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
      sunday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
    }),
    updateShopSchedule: async (params) => {
      received.payload = params;
      return params.schedule;
    },
    getBarberSchedule: async () => ({
      monday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
      tuesday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
      wednesday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
      thursday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
      friday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
      saturday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
      sunday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
    }),
    updateBarberSchedule: async (params) => params.schedule,
  });

  const schedule = {
    monday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
    tuesday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
    wednesday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
    thursday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
    friday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
    saturday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
    sunday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
  } as any;

  await useCase.execute({
    context: requestContext,
    schedule,
  });

  assert.deepEqual(received.payload, {
    localId: 'local-1',
    schedule,
  });
});

test('get barber schedule use case forwards localId and barberId', async () => {
  const calls: unknown[] = [];
  const useCase = new GetBarberScheduleUseCase({
    getShopSchedule: async () => ({} as any),
    updateShopSchedule: async () => ({} as any),
    getBarberSchedule: async (params) => {
      calls.push(params);
      return {} as any;
    },
    updateBarberSchedule: async () => ({} as any),
  });

  await useCase.execute({
    context: requestContext,
    barberId: 'barber-1',
  });

  assert.deepEqual(calls, [{ localId: 'local-1', barberId: 'barber-1' }]);
});

test('add barber holiday use case normalizes reversed range and returns updated holidays', async () => {
  const calls: Array<{ type: string; payload: unknown }> = [];
  const useCase = new AddBarberHolidayUseCase({
    getGeneralHolidays: async () => [],
    addGeneralHolidayIfMissing: async () => undefined,
    removeGeneralHoliday: async () => undefined,
    getBarberHolidays: async (params) => {
      calls.push({ type: 'getBarberHolidays', payload: params });
      return [{ start: '2026-05-01', end: '2026-05-02' }];
    },
    addBarberHolidayIfMissing: async (params) => {
      calls.push({ type: 'addBarberHolidayIfMissing', payload: params });
    },
    removeBarberHoliday: async () => undefined,
  });

  const result = await useCase.execute({
    context: requestContext,
    barberId: 'barber-42',
    range: {
      start: '2026-05-02',
      end: '2026-05-01',
    },
  });

  assert.deepEqual(calls, [
    {
      type: 'addBarberHolidayIfMissing',
      payload: { localId: 'local-1', barberId: 'barber-42', start: '2026-05-01', end: '2026-05-02' },
    },
    {
      type: 'getBarberHolidays',
      payload: { localId: 'local-1', barberId: 'barber-42' },
    },
  ]);
  assert.deepEqual(result, [{ start: '2026-05-01', end: '2026-05-02' }]);
});

test('remove general holiday use case normalizes reversed range and returns updated holidays', async () => {
  const calls: Array<{ type: string; payload: unknown }> = [];
  const useCase = new RemoveGeneralHolidayUseCase({
    getGeneralHolidays: async (params) => {
      calls.push({ type: 'getGeneralHolidays', payload: params });
      return [];
    },
    addGeneralHolidayIfMissing: async () => undefined,
    removeGeneralHoliday: async (params) => {
      calls.push({ type: 'removeGeneralHoliday', payload: params });
    },
    getBarberHolidays: async () => [],
    addBarberHolidayIfMissing: async () => undefined,
    removeBarberHoliday: async () => undefined,
  });

  await useCase.execute({
    context: requestContext,
    range: {
      start: '2026-06-20',
      end: '2026-06-10',
    },
  });

  assert.deepEqual(calls, [
    {
      type: 'removeGeneralHoliday',
      payload: { localId: 'local-1', start: '2026-06-10', end: '2026-06-20' },
    },
    {
      type: 'getGeneralHolidays',
      payload: { localId: 'local-1' },
    },
  ]);
});

test('get general/barber holidays use cases keep tenant scope and ids', async () => {
  const calls: Array<{ type: string; payload: unknown }> = [];
  const holidayPort = {
    getGeneralHolidays: async (params: { localId: string }) => {
      calls.push({ type: 'getGeneralHolidays', payload: params });
      return [];
    },
    addGeneralHolidayIfMissing: async () => undefined,
    removeGeneralHoliday: async () => undefined,
    getBarberHolidays: async (params: { localId: string; barberId: string }) => {
      calls.push({ type: 'getBarberHolidays', payload: params });
      return [];
    },
    addBarberHolidayIfMissing: async () => undefined,
    removeBarberHoliday: async () => undefined,
  };

  const getGeneral = new GetGeneralHolidaysUseCase(holidayPort);
  const getBarber = new GetBarberHolidaysUseCase(holidayPort);

  await getGeneral.execute({
    context: requestContext,
  });
  await getBarber.execute({
    context: requestContext,
    barberId: 'barber-7',
  });

  assert.deepEqual(calls, [
    { type: 'getGeneralHolidays', payload: { localId: 'local-1' } },
    { type: 'getBarberHolidays', payload: { localId: 'local-1', barberId: 'barber-7' } },
  ]);
});

test('get shop schedule and update barber schedule use cases forward scoped payloads', async () => {
  const calls: Array<{ type: string; payload: unknown }> = [];
  const schedule = {
    monday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
    tuesday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
    wednesday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
    thursday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
    friday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
    saturday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
    sunday: { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } },
  } as any;

  const schedulePort = {
    getShopSchedule: async (params: { localId: string }) => {
      calls.push({ type: 'getShopSchedule', payload: params });
      return schedule;
    },
    updateShopSchedule: async () => schedule,
    getBarberSchedule: async () => schedule,
    updateBarberSchedule: async (params: { localId: string; barberId: string; schedule: unknown }) => {
      calls.push({ type: 'updateBarberSchedule', payload: params });
      return schedule;
    },
  };

  const getShopSchedule = new GetShopScheduleUseCase(schedulePort);
  const updateBarberSchedule = new UpdateBarberScheduleUseCase(schedulePort);

  await getShopSchedule.execute({ context: requestContext });
  await updateBarberSchedule.execute({
    context: requestContext,
    barberId: 'barber-9',
    schedule,
  });

  assert.deepEqual(calls, [
    { type: 'getShopSchedule', payload: { localId: 'local-1' } },
    {
      type: 'updateBarberSchedule',
      payload: { localId: 'local-1', barberId: 'barber-9', schedule },
    },
  ]);
});

test('get weekly load use case keeps date scope and fills missing barbers with zero', async () => {
  const calls: unknown[] = [];
  const useCase = new GetWeeklyLoadUseCase({
    listAppointmentsForBarberDay: async () => [],
    listAppointmentsForBarbersDay: async () => [],
    countWeeklyLoad: async (params) => {
      calls.push(params);
      return { barberA: 3 };
    },
  });

  const result = await useCase.execute({
    context: requestContext,
    dateFrom: '2026-03-01',
    dateTo: '2026-03-07',
    barberIds: ['barberA', 'barberB'],
  });

  assert.deepEqual(calls, [
    {
      localId: 'local-1',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
      barberIds: ['barberA', 'barberB'],
    },
  ]);
  assert.deepEqual(result, {
    counts: {
      barberA: 3,
      barberB: 0,
    },
  });
});
