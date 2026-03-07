import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SHOP_SCHEDULE as legacyDefaultSchedule } from '@/modules/schedules/schedule.types';
import {
  cloneSchedule as legacyCloneSchedule,
  normalizeSchedule as legacyNormalizeSchedule,
} from '@/modules/schedules/schedule.utils';
import {
  DEFAULT_SHOP_SCHEDULE,
  cloneSchedule,
  normalizeSchedule,
} from '@/contexts/booking/infrastructure/prisma/support/schedule.policy';

test('schedule support default matches legacy default', () => {
  assert.deepEqual(DEFAULT_SHOP_SCHEDULE, legacyDefaultSchedule);
});

test('schedule support normalize matches legacy normalize', () => {
  const input = {
    bufferMinutes: 5,
    endOverflowMinutes: undefined,
    endOverflowByDay: { friday: 20 },
    breaksByDate: {
      '2026-03-10': [
        { start: '13:00', end: '12:30' },
        { start: '13:30', end: '14:00' },
      ],
    },
    monday: { open: '08:00', close: '16:00', closed: false },
    tuesday: {
      closed: false,
      morning: { enabled: true, start: '09:00', end: '13:00' },
      afternoon: { enabled: true, start: '15:00', end: '20:00' },
    },
  } as any;

  const legacy = legacyNormalizeSchedule(input, { preserveEndOverflowUndefined: true });
  const current = normalizeSchedule(input, { preserveEndOverflowUndefined: true });

  assert.deepEqual(current, legacy);
});

test('schedule support clone matches legacy clone behavior', () => {
  const input = legacyNormalizeSchedule(legacyDefaultSchedule);

  const legacy = legacyCloneSchedule(input as any);
  const current = cloneSchedule(input as any);

  assert.deepEqual(current, legacy);
  assert.notEqual(current, input);
  assert.notEqual(current.monday, (input as any).monday);
});
