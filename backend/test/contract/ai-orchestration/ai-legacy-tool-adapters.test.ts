import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ModuleAiAlertToolAdapter } from '@/modules/ai-assistant/adapters/module-ai-alert-tool.adapter';
import { ModuleAiBookingToolAdapter } from '@/modules/ai-assistant/adapters/module-ai-booking-tool.adapter';
import { ModuleAiHolidayToolAdapter } from '@/modules/ai-assistant/adapters/module-ai-holiday-tool.adapter';

test('ai booking adapter delegates create/weeklyLoad/batch to appointments facade', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const adapter = new ModuleAiBookingToolAdapter({
    create: async (payload: Record<string, unknown>, context: Record<string, unknown>) => {
      calls.push({ kind: 'create', payload, context });
      return { id: 'apt-1', startDateTime: '2026-03-04T10:00:00.000Z' };
    },
    getWeeklyLoad: async () => ({ counts: { barber1: 3 } }),
    getAvailabilityBatch: async () => ({ barber1: ['10:00'] }),
  } as any);

  const created = await adapter.createAppointment({
    barberId: 'barber1',
    serviceId: 'service1',
    startDateTime: '2026-03-04T10:00:00.000Z',
    notes: 'AI note',
  });
  const weekly = await adapter.getWeeklyLoad('2026-03-03', '2026-03-09', ['barber1']);
  const batch = await adapter.getAvailableSlotsBatch('2026-03-04', ['barber1'], { serviceId: 'service1' });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, 'create');
  assert.equal((calls[0].context as any).requireConsent, false);
  assert.equal(created.id, 'apt-1');
  assert.equal(created.startDateTime, '2026-03-04T10:00:00.000Z');
  assert.deepEqual(weekly, { counts: { barber1: 3 } });
  assert.deepEqual(batch, { barber1: ['10:00'] });
});

test('ai holiday adapter delegates holiday operations', async () => {
  const calls: string[] = [];
  const adapter = new ModuleAiHolidayToolAdapter({
    getGeneralHolidays: async () => {
      calls.push('getGeneral');
      return [{ start: '2026-08-01', end: '2026-08-02' }];
    },
    addGeneralHoliday: async () => {
      calls.push('addGeneral');
      return [{ start: '2026-08-01', end: '2026-08-02' }];
    },
    addBarberHoliday: async () => {
      calls.push('addBarber');
      return [{ start: '2026-08-01', end: '2026-08-02' }];
    },
  } as any);

  await adapter.getGeneralHolidays();
  await adapter.addGeneralHoliday({ start: '2026-08-01', end: '2026-08-02' });
  await adapter.addBarberHoliday('barber-1', { start: '2026-08-01', end: '2026-08-02' });

  assert.deepEqual(calls, ['getGeneral', 'addGeneral', 'addBarber']);
});

test('ai alert adapter delegates alert creation and maps response', async () => {
  const adapter = new ModuleAiAlertToolAdapter({
    create: async () => ({
      id: 'alert-1',
      title: 'Promo',
      message: 'Semana especial',
      type: 'warning',
    }),
  } as any);

  const created = await adapter.createAlert({
    title: 'Promo',
    message: 'Semana especial',
    type: 'warning' as any,
    active: true,
  });

  assert.deepEqual(created, {
    id: 'alert-1',
    title: 'Promo',
    message: 'Semana especial',
    type: 'warning',
  });
});
