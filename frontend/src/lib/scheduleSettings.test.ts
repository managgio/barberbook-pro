import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_SETTINGS } from '@/data/salonInfo';
import {
  copyScheduleBreaks, copyScheduleDays, formatScheduleDate, isValidScheduleDraft, setScheduleDayOpen,
} from './scheduleSettings';

const schedule = () => structuredClone(DEFAULT_SITE_SETTINGS.openingHours);

describe('schedule settings', () => {
  it('renders an invalid stored date without crashing the editor', () => {
    expect(formatScheduleDate('2026-99-99', 'es')).toBe('2026-99-99');
    expect(formatScheduleDate('2026-11-10', 'es')).toContain('2026');
  });
  it('copies only selected days without changing rules, exceptions or the source', () => {
    const original = {
      ...schedule(), bufferMinutes: 10, endOverflowByDay: { friday: 0 },
      breaksByDate: { '2026-11-10': [{ start: '12:00', end: '12:30' }] },
      extraordinaryOpenings: { '2026-11-15': { ...schedule().monday, allProfessionals: true, barberIds: [] } },
    };
    const next = copyScheduleDays(original, 'monday', ['tuesday', 'monday']);
    expect(next.tuesday).toEqual(original.monday);
    expect(next.tuesday).not.toBe(original.monday);
    expect(next.tuesday.morning).not.toBe(original.monday.morning);
    expect(next.wednesday).toBe(original.wednesday);
    expect(next.breaksByDate).toBe(original.breaksByDate);
    expect(next.extraordinaryOpenings).toBe(original.extraordinaryOpenings);
    expect(next.endOverflowByDay.friday).toBe(0);
    expect(next.bufferMinutes).toBe(10);
  });

  it('replaces copied breaks without duplicating the source or accumulating repeated copies', () => {
    const original = schedule();
    original.breaks = {
      monday: [{ start: '12:00', end: '12:30' }], tuesday: [{ start: '13:00', end: '13:30' }],
      wednesday: [], thursday: [], friday: [], saturday: [], sunday: [],
    };
    original.breaksByDate = { '2026-11-10': [{ start: '16:00', end: '16:30' }] };
    const once = copyScheduleBreaks(original, 'monday', ['monday', 'tuesday']);
    const twice = copyScheduleBreaks(once, 'monday', ['tuesday']);
    expect(twice.breaks?.monday).toEqual(original.breaks.monday);
    expect(twice.breaks?.tuesday).toEqual(original.breaks.monday);
    expect(twice.breaks?.tuesday?.[0]).not.toBe(original.breaks.monday[0]);
    expect(original.breaks.tuesday).toEqual([{ start: '13:00', end: '13:30' }]);
    expect(twice.breaksByDate).toBe(original.breaksByDate);
  });

  it('keeps configured shifts when closing and reopening a day', () => {
    const day = schedule().monday;
    const closed = setScheduleDayOpen(day, false);
    expect(closed.closed).toBe(true);
    expect(setScheduleDayOpen(closed, true)).toEqual(day);
    const empty = { closed: true, morning: { enabled: false, start: '00:00', end: '00:00' }, afternoon: { enabled: false, start: '00:00', end: '00:00' } };
    expect(setScheduleDayOpen(empty, true).morning).toEqual({ enabled: true, start: '09:00', end: '14:00' });
  });

  it('blocks invalid times and minutes while preserving an explicit zero override', () => {
    const value = schedule();
    value.endOverflowMinutes = 15;
    value.endOverflowByDay = { friday: 0 };
    expect(isValidScheduleDraft(value)).toBe(true);
    value.monday = { closed: false, morning: { enabled: true, start: '14:00', end: '09:00' }, afternoon: { enabled: false, start: '', end: '' } };
    expect(isValidScheduleDraft(value)).toBe(false);
    value.monday.closed = true;
    expect(isValidScheduleDraft(value)).toBe(true);
    value.bufferMinutes = -1;
    expect(isValidScheduleDraft(value)).toBe(false);
    value.bufferMinutes = 1.5;
    expect(isValidScheduleDraft(value)).toBe(false);
    value.bufferMinutes = 0;
    value.breaksByDate = { '2026-11-10': [{ start: '13:00', end: '13:00' }] };
    expect(isValidScheduleDraft(value)).toBe(false);
  });
});
