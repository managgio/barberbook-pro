import { describe, expect, it } from 'vitest';

import type { ShopSchedule } from '@/data/types';
import { mergeShopScheduleAvailability } from '@/lib/shopSchedule';

const day = (start: string) => ({
  closed: false,
  morning: { enabled: true, start, end: '14:00' },
  afternoon: { enabled: false, start: '15:00', end: '20:00' },
});

const schedule = (start: string): ShopSchedule => ({
  monday: day(start),
  tuesday: day(start),
  wednesday: day(start),
  thursday: day(start),
  friday: day(start),
  saturday: day(start),
  sunday: day(start),
});

describe('mergeShopScheduleAvailability', () => {
  it('combines edited opening hours and breaks into one schedule write', () => {
    const persistedSchedule = {
      ...schedule('09:00'),
      bufferMinutes: 15,
      breaks: { ...schedule('09:00').breaks, monday: [{ start: '12:00', end: '12:30' }] },
      breaksByDate: { '2026-09-30': [{ start: '10:00', end: '11:00' }] },
    };

    const merged = mergeShopScheduleAvailability(persistedSchedule, schedule('10:00'));

    expect(merged.monday.morning.start).toBe('10:00');
    expect(merged.breaks?.monday).toEqual([{ start: '12:00', end: '12:30' }]);
    expect(merged.breaksByDate?.['2026-09-30']).toEqual([{ start: '10:00', end: '11:00' }]);
    expect(merged.bufferMinutes).toBe(15);
  });
});
