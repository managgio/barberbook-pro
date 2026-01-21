import {
  BreakRange,
  BreakSchedule,
  DayKey,
  DaySchedule,
  HolidayRange,
  ShiftSchedule,
  ShopSchedule,
  DEFAULT_SHOP_SCHEDULE,
} from './schedule.types';

export const DAY_KEYS: DayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const toISODate = (value: string) => value.split('T')[0];

export const normalizeRange = (range: HolidayRange): HolidayRange => {
  const start = toISODate(range.start);
  const end = toISODate(range.end || range.start);
  if (start <= end) {
    return { start, end };
  }
  return { start: end, end: start };
};

export const rangesEqual = (a: HolidayRange, b: HolidayRange) => a.start === b.start && a.end === b.end;

export const normalizeRangeList = (input: unknown, fallback: HolidayRange[]) => {
  if (!Array.isArray(input)) return fallback.map((range) => ({ ...range }));
  if (input.length > 0 && typeof input[0] === 'string') {
    return (input as string[]).map((date) => normalizeRange({ start: date, end: date }));
  }
  return (input as HolidayRange[]).map((range) => normalizeRange(range));
};

export const normalizeRangeRecord = (input: unknown, fallback: Record<string, HolidayRange[]>) => {
  const record: Record<string, HolidayRange[]> = {};
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : fallback;
  Object.entries(source).forEach(([id, ranges]) => {
    record[id] = normalizeRangeList(ranges, fallback[id] || []);
  });
  return record;
};

export const isDateInRange = (date: string, range: HolidayRange) => date >= range.start && date <= range.end;

const cloneDaySchedule = (day: DaySchedule): DaySchedule => ({
  closed: day.closed,
  morning: { ...day.morning },
  afternoon: { ...day.afternoon },
});

export const cloneSchedule = (schedule: ShopSchedule): ShopSchedule =>
  JSON.parse(JSON.stringify(schedule));

const normalizeBufferMinutes = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};

const parseTime = (value?: string | null): number | null => {
  if (!value) return null;
  const [hour, minute] = value.split(':').map((part) => Number(part));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
};

const normalizeBreaks = (input?: unknown): BreakSchedule => {
  const fallback: BreakSchedule = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
  if (!input || typeof input !== 'object') return fallback;
  const record = input as Record<string, unknown>;
  const normalized: BreakSchedule = { ...fallback };
  DAY_KEYS.forEach((day) => {
    const ranges = record[day];
    if (!Array.isArray(ranges)) return;
    normalized[day] = (ranges as BreakRange[])
      .map((range) => {
        const startMinutes = parseTime(range?.start);
        const endMinutes = parseTime(range?.end);
        if (startMinutes === null || endMinutes === null) return null;
        if (startMinutes === endMinutes) return null;
        if (startMinutes > endMinutes) {
          return { start: range.end, end: range.start };
        }
        return { start: range.start, end: range.end };
      })
      .filter((range): range is BreakRange => Boolean(range));
  });
  return normalized;
};

const normalizeShift = (
  shift: Partial<ShiftSchedule> | undefined,
  fallback: ShiftSchedule,
): ShiftSchedule => ({
  enabled: shift?.enabled ?? fallback.enabled,
  start: shift?.start || fallback.start,
  end: shift?.end || fallback.end,
});

const convertLegacyDay = (
  legacy: { open?: string; close?: string; closed?: boolean } | undefined,
  fallback: DaySchedule,
): DaySchedule => {
  if (!legacy) return cloneDaySchedule(fallback);
  const open = legacy.open || fallback.morning.start;
  const close = legacy.close || fallback.afternoon.end;
  const closed = legacy.closed ?? false;
  const morning: ShiftSchedule = {
    enabled: !closed,
    start: open,
    end: close,
  };
  const afternoon: ShiftSchedule = {
    ...fallback.afternoon,
    enabled: false,
  };
  return {
    closed: closed || (!morning.enabled && !afternoon.enabled),
    morning,
    afternoon,
  };
};

export const normalizeSchedule = (schedule?: Partial<ShopSchedule>): ShopSchedule => {
  const normalized: Partial<ShopSchedule> = {};
  normalized.bufferMinutes = normalizeBufferMinutes(schedule?.bufferMinutes);
  normalized.breaks = normalizeBreaks(schedule?.breaks);
  DAY_KEYS.forEach((day) => {
    const fallback = cloneDaySchedule(DEFAULT_SHOP_SCHEDULE[day]);
    const dayData = schedule?.[day] as Partial<DaySchedule> | undefined;
    const isLegacy = dayData && Object.prototype.hasOwnProperty.call(dayData, 'open');
    if (isLegacy) {
      normalized[day] = convertLegacyDay(
        dayData as { open?: string; close?: string; closed?: boolean },
        fallback,
      );
      return;
    }
    const morning = normalizeShift(dayData?.morning, fallback.morning);
    const afternoon = normalizeShift(dayData?.afternoon, fallback.afternoon);
    let closed = dayData?.closed ?? fallback.closed;
    if (!morning.enabled && !afternoon.enabled) {
      closed = true;
    }
    normalized[day] = {
      closed,
      morning,
      afternoon,
    };
  });
  return normalized as ShopSchedule;
};

export const timeToMinutes = (time: string): number => {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};

export const minutesToTime = (minutes: number): string => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

export const generateSlotsForShift = (shift: ShiftSchedule, serviceDuration: number, interval = 15): string[] => {
  if (!shift.enabled) return [];
  const startMinutes = timeToMinutes(shift.start);
  const endMinutes = timeToMinutes(shift.end);
  const slots: string[] = [];

  if (startMinutes >= endMinutes || serviceDuration <= 0) return slots;

  for (let current = startMinutes; current + serviceDuration <= endMinutes; current += interval) {
    slots.push(minutesToTime(current));
  }

  return slots;
};
