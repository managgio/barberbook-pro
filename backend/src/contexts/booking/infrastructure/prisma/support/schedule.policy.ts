import {
  BookingSchedulePolicy,
  BreakRange,
  BreakSchedule,
  BreakScheduleByDate,
  DayKey,
  DaySchedule,
  ShiftSchedule,
} from '../../../domain/value-objects/schedule';

const createDaySchedule = (
  morning: [string, string] | null,
  afternoon: [string, string] | null,
): DaySchedule => ({
  closed: !morning && !afternoon,
  morning: {
    enabled: Boolean(morning),
    start: morning ? morning[0] : '00:00',
    end: morning ? morning[1] : '00:00',
  },
  afternoon: {
    enabled: Boolean(afternoon),
    start: afternoon ? afternoon[0] : '00:00',
    end: afternoon ? afternoon[1] : '00:00',
  },
});

export const DEFAULT_SHOP_SCHEDULE: BookingSchedulePolicy = {
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
  monday: createDaySchedule(['09:00', '14:00'], ['15:00', '20:00']),
  tuesday: createDaySchedule(['09:00', '14:00'], ['15:00', '20:00']),
  wednesday: createDaySchedule(['09:00', '14:00'], ['15:00', '20:00']),
  thursday: createDaySchedule(['09:00', '14:00'], ['15:00', '20:00']),
  friday: createDaySchedule(['09:00', '14:00'], ['15:00', '21:00']),
  saturday: createDaySchedule(['09:30', '13:30'], ['15:30', '18:00']),
  sunday: createDaySchedule(null, null),
};

export const DAY_KEYS: DayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const cloneDaySchedule = (day: DaySchedule): DaySchedule => ({
  closed: day.closed,
  morning: { ...day.morning },
  afternoon: { ...day.afternoon },
});

export const cloneSchedule = (schedule: BookingSchedulePolicy): BookingSchedulePolicy =>
  JSON.parse(JSON.stringify(schedule));

const normalizeBufferMinutes = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};

const normalizeEndOverflowMinutes = (value: unknown): number => normalizeBufferMinutes(value);
const ISO_DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type EndOverflowByDay = Partial<Record<DayKey, number>>;
type EndOverflowByDate = Record<string, number>;

const parseTime = (value?: string | null): number | null => {
  if (!value) return null;
  const [hour, minute] = value.split(':').map((part) => Number(part));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
};

const normalizeBreakRange = (range: BreakRange | null | undefined): BreakRange | null => {
  const startMinutes = parseTime(range?.start);
  const endMinutes = parseTime(range?.end);
  if (startMinutes === null || endMinutes === null) return null;
  if (startMinutes === endMinutes) return null;
  if (startMinutes > endMinutes) {
    return { start: range!.end, end: range!.start };
  }
  return { start: range!.start, end: range!.end };
};

const normalizeBreakRangesList = (ranges: unknown): BreakRange[] => {
  if (!Array.isArray(ranges)) return [];
  return (ranges as BreakRange[])
    .map((range) => normalizeBreakRange(range))
    .filter((range): range is BreakRange => Boolean(range));
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
    normalized[day] = normalizeBreakRangesList(record[day]);
  });
  return normalized;
};

const normalizeBreaksByDate = (input?: unknown): BreakScheduleByDate => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const record = input as Record<string, unknown>;
  const normalized: BreakScheduleByDate = {};
  Object.entries(record).forEach(([dateKey, ranges]) => {
    if (!ISO_DATE_KEY_REGEX.test(dateKey)) return;
    const normalizedRanges = normalizeBreakRangesList(ranges);
    if (normalizedRanges.length > 0) {
      normalized[dateKey] = normalizedRanges;
    }
  });
  return normalized;
};

const normalizeEndOverflowByDay = (input?: unknown): EndOverflowByDay => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const record = input as Record<string, unknown>;
  const normalized: EndOverflowByDay = {};
  DAY_KEYS.forEach((day) => {
    if (record[day] === undefined || record[day] === null || record[day] === '') return;
    normalized[day] = normalizeEndOverflowMinutes(record[day]);
  });
  return normalized;
};

const normalizeEndOverflowByDate = (input?: unknown): EndOverflowByDate => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const record = input as Record<string, unknown>;
  const normalized: EndOverflowByDate = {};
  Object.entries(record).forEach(([dateKey, value]) => {
    if (!ISO_DATE_KEY_REGEX.test(dateKey)) return;
    if (value === undefined || value === null || value === '') return;
    normalized[dateKey] = normalizeEndOverflowMinutes(value);
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

export const normalizeSchedule = (
  schedule?: Partial<BookingSchedulePolicy>,
  options?: { preserveEndOverflowUndefined?: boolean },
): BookingSchedulePolicy => {
  const normalized: Partial<BookingSchedulePolicy> = {};
  normalized.bufferMinutes = normalizeBufferMinutes(schedule?.bufferMinutes);
  if (options?.preserveEndOverflowUndefined && schedule?.endOverflowMinutes === undefined) {
    normalized.endOverflowMinutes = undefined;
  } else {
    normalized.endOverflowMinutes = normalizeEndOverflowMinutes(
      schedule?.endOverflowMinutes ?? DEFAULT_SHOP_SCHEDULE.endOverflowMinutes,
    );
  }
  if (options?.preserveEndOverflowUndefined && schedule?.endOverflowByDay === undefined) {
    normalized.endOverflowByDay = undefined;
  } else {
    normalized.endOverflowByDay = normalizeEndOverflowByDay(
      schedule?.endOverflowByDay ?? DEFAULT_SHOP_SCHEDULE.endOverflowByDay,
    );
  }
  if (options?.preserveEndOverflowUndefined && schedule?.endOverflowByDate === undefined) {
    normalized.endOverflowByDate = undefined;
  } else {
    normalized.endOverflowByDate = normalizeEndOverflowByDate(
      schedule?.endOverflowByDate ?? DEFAULT_SHOP_SCHEDULE.endOverflowByDate,
    );
  }
  normalized.breaks = normalizeBreaks(schedule?.breaks);
  normalized.breaksByDate = normalizeBreaksByDate(schedule?.breaksByDate);
  DAY_KEYS.forEach((day) => {
    const fallback = cloneDaySchedule(DEFAULT_SHOP_SCHEDULE[day]);
    const dayData = schedule?.[day] as Partial<DaySchedule> | undefined;
    const isLegacy = dayData && Object.prototype.hasOwnProperty.call(dayData, 'open');
    if (isLegacy) {
      normalized[day] = convertLegacyDay(dayData as { open?: string; close?: string; closed?: boolean }, fallback);
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
  return normalized as BookingSchedulePolicy;
};
