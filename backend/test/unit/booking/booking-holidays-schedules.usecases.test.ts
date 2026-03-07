import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { AddGeneralHolidayUseCase } from '@/contexts/booking/application/use-cases/add-general-holiday.use-case';
import { RemoveBarberHolidayUseCase } from '@/contexts/booking/application/use-cases/remove-barber-holiday.use-case';
import { GetBarberScheduleUseCase } from '@/contexts/booking/application/use-cases/get-barber-schedule.use-case';
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

