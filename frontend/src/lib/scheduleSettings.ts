import type { BreakRange, DayKey, DaySchedule, ShopSchedule } from '@/data/types';

export const SCHEDULE_DAYS: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const SCHEDULE_DAY_LABELS: Record<DayKey, string> = {
  monday: 'admin.settings.day.monday',
  tuesday: 'admin.settings.day.tuesday',
  wednesday: 'admin.settings.day.wednesday',
  thursday: 'admin.settings.day.thursday',
  friday: 'admin.settings.day.friday',
  saturday: 'admin.settings.day.saturday',
  sunday: 'admin.settings.day.sunday',
};
export const SCHEDULE_SHIFTS = ['morning', 'afternoon'] as const;

export const formatScheduleDate = (value: string, language: string) => {
  const parsed = new Date(value + 'T12:00:00');
  return Number.isNaN(parsed.getTime()) ? value
    : new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(parsed);
};

export const isValidScheduleRange = (range: BreakRange) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(range.start)
  && /^([01]\d|2[0-3]):[0-5]\d$/.test(range.end)
  && range.start < range.end;

export const isValidScheduleDay = (day: DaySchedule) => day.closed || (
  SCHEDULE_SHIFTS.some((shift) => day[shift].enabled)
  && SCHEDULE_SHIFTS.every((shift) => !day[shift].enabled || isValidScheduleRange(day[shift]))
  && (!day.morning.enabled || !day.afternoon.enabled || day.morning.end <= day.afternoon.start)
);

export const isValidScheduleMinutes = (value?: number) =>
  value === undefined || (Number.isInteger(value) && value >= 0);

export const isValidScheduleDraft = (schedule: ShopSchedule) =>
  SCHEDULE_DAYS.every((day) => isValidScheduleDay(schedule[day]))
  && [schedule.bufferMinutes, schedule.endOverflowMinutes,
    ...Object.values(schedule.endOverflowByDay ?? {}),
    ...Object.values(schedule.endOverflowByDate ?? {})].every(isValidScheduleMinutes)
  && [...Object.values(schedule.breaks ?? {}), ...Object.values(schedule.breaksByDate ?? {})]
    .every((ranges) => ranges.every(isValidScheduleRange));

export const setScheduleDayOpen = (day: DaySchedule, open: boolean): DaySchedule => {
  if (!open || day.morning.enabled || day.afternoon.enabled) return { ...day, closed: !open };
  return {
    ...day,
    closed: false,
    morning: {
      ...day.morning,
      enabled: true,
      ...(isValidScheduleRange(day.morning) ? {} : { start: '09:00', end: '14:00' }),
    },
  };
};

export const copyScheduleDays = (schedule: ShopSchedule, source: DayKey, targets: DayKey[]): ShopSchedule => {
  const next = { ...schedule };
  targets.filter((day) => day !== source).forEach((day) => {
    next[day] = {
      ...schedule[source],
      morning: { ...schedule[source].morning },
      afternoon: { ...schedule[source].afternoon },
    };
  });
  return next;
};

export const copyScheduleBreaks = (schedule: ShopSchedule, source: DayKey, targets: DayKey[]): ShopSchedule => {
  const breaks = Object.fromEntries(SCHEDULE_DAYS.map((day) => [day, schedule.breaks?.[day] ?? []])) as Record<DayKey, BreakRange[]>;
  targets.filter((day) => day !== source).forEach((day) => {
    breaks[day] = (schedule.breaks?.[source] ?? []).map((range) => ({ ...range }));
  });
  return { ...schedule, breaks };
};
