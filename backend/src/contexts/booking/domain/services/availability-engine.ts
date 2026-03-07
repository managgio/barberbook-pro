import { isDateInRange } from '../value-objects/date-range';
import { BookingSchedulePolicy, BreakRange, resolveDayKey } from '../value-objects/schedule';
import { DEFAULT_SLOT_INTERVAL_MINUTES, minutesToTime, timeToMinutes } from '../value-objects/time-slot';

export const DEFAULT_SERVICE_DURATION_MINUTES = 30;

type AvailabilityAppointment = {
  startDateTime: Date;
  durationMinutes?: number | null;
};

type ComputeSlotsParams = {
  dateOnly: string;
  timezone: string;
  barberSchedule: BookingSchedulePolicy;
  shopSchedule: BookingSchedulePolicy;
  appointments: AvailabilityAppointment[];
  targetDurationMinutes: number;
  slotIntervalMinutes?: number;
};

const normalizePositiveInt = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

const resolveEndOverflowFromSchedule = (params: {
  schedule: BookingSchedulePolicy | null | undefined;
  dayKey: ReturnType<typeof resolveDayKey>;
  dateOnly: string;
}): number | null => {
  const { schedule, dayKey, dateOnly } = params;
  if (!schedule) return null;

  const byDate = schedule.endOverflowByDate?.[dateOnly];
  if (typeof byDate === 'number' && Number.isFinite(byDate)) {
    return normalizePositiveInt(byDate);
  }

  const byDay = schedule.endOverflowByDay?.[dayKey];
  if (typeof byDay === 'number' && Number.isFinite(byDay)) {
    return normalizePositiveInt(byDay);
  }

  const global = schedule.endOverflowMinutes;
  if (typeof global === 'number' && Number.isFinite(global)) {
    return normalizePositiveInt(global);
  }

  return null;
};

export const resolveEndOverflowMinutes = (params: {
  dateOnly: string;
  timezone: string;
  barberSchedule: BookingSchedulePolicy | null | undefined;
  shopSchedule: BookingSchedulePolicy | null | undefined;
}) => {
  const dayKey = resolveDayKey(params.dateOnly, params.timezone);

  const barberValue = resolveEndOverflowFromSchedule({
    schedule: params.barberSchedule,
    dayKey,
    dateOnly: params.dateOnly,
  });
  if (barberValue !== null) return barberValue;

  const shopValue = resolveEndOverflowFromSchedule({
    schedule: params.shopSchedule,
    dayKey,
    dateOnly: params.dateOnly,
  });

  return shopValue ?? 0;
};

const formatTimeInTimeZone = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);

  const hour = parts.find((part) => part.type === 'hour')?.value || '00';
  const minute = parts.find((part) => part.type === 'minute')?.value || '00';
  return `${hour}:${minute}`;
};

const subtractRange = (
  intervals: Array<{ start: number; end: number }>,
  block: { start: number; end: number },
) => {
  if (intervals.length === 0) return intervals;
  const next: Array<{ start: number; end: number }> = [];

  intervals.forEach((interval) => {
    if (block.end <= interval.start || block.start >= interval.end) {
      next.push(interval);
      return;
    }
    if (block.start > interval.start) {
      next.push({ start: interval.start, end: Math.min(block.start, interval.end) });
    }
    if (block.end < interval.end) {
      next.push({ start: Math.max(block.end, interval.start), end: interval.end });
    }
  });

  return next;
};

const normalizeBreaks = (ranges: BreakRange[]) =>
  ranges
    .map((range) => ({
      start: timeToMinutes(range.start),
      end: timeToMinutes(range.end),
    }))
    .filter((range) => range.end > range.start);

export const computeAvailableSlotsForBarber = (params: ComputeSlotsParams): string[] => {
  const {
    dateOnly,
    timezone,
    barberSchedule,
    shopSchedule,
    appointments,
    targetDurationMinutes,
    slotIntervalMinutes = DEFAULT_SLOT_INTERVAL_MINUTES,
  } = params;

  const dayKey = resolveDayKey(dateOnly, timezone);
  const daySchedule = barberSchedule[dayKey];
  if (!daySchedule || daySchedule.closed) return [];

  const bufferMinutes = normalizePositiveInt(shopSchedule.bufferMinutes);
  const durationWithBuffer = Math.max(0, targetDurationMinutes) + bufferMinutes;
  if (durationWithBuffer <= 0) return [];

  const endOverflowMinutes = resolveEndOverflowMinutes({
    dateOnly,
    timezone,
    barberSchedule,
    shopSchedule,
  });

  const dayBreaks = [
    ...(shopSchedule.breaks?.[dayKey] ?? []),
    ...(shopSchedule.breaksByDate?.[dateOnly] ?? []),
  ];

  const lastShiftKey = daySchedule.afternoon?.enabled
    ? 'afternoon'
    : daySchedule.morning?.enabled
      ? 'morning'
      : null;

  const getShiftLimits = (
    shift: { enabled: boolean; start: string; end: string },
    applyOverflow: boolean,
  ) => {
    const startMinutes = timeToMinutes(shift.start);
    const endMinutes = timeToMinutes(shift.end);
    const maxEnd = applyOverflow
      ? Math.min(endMinutes + endOverflowMinutes, 24 * 60 - 1)
      : endMinutes;
    return { startMinutes, endMinutes, maxEnd };
  };

  const generateShiftSlots = (
    shift: { enabled: boolean; start: string; end: string },
    applyOverflow: boolean,
  ) => {
    if (!shift.enabled) return [] as string[];

    const { startMinutes, endMinutes, maxEnd } = getShiftLimits(shift, applyOverflow);
    if (startMinutes >= endMinutes) return [];

    const slots: string[] = [];
    for (let current = startMinutes; current < endMinutes; current += slotIntervalMinutes) {
      if (current + durationWithBuffer <= maxEnd) {
        slots.push(minutesToTime(current));
      }
    }
    return slots;
  };

  const morningLimits = getShiftLimits(daySchedule.morning, lastShiftKey === 'morning');
  const afternoonLimits = getShiftLimits(daySchedule.afternoon, lastShiftKey === 'afternoon');

  const rawSlots = [
    ...generateShiftSlots(daySchedule.morning, lastShiftKey === 'morning'),
    ...generateShiftSlots(daySchedule.afternoon, lastShiftKey === 'afternoon'),
  ];

  if (rawSlots.length === 0) return [];

  const uniqueSlots = Array.from(new Set(rawSlots));

  const bookedRanges = appointments.map((appointment) => {
    const startMinutes = timeToMinutes(formatTimeInTimeZone(appointment.startDateTime, timezone));
    const duration = normalizePositiveInt(appointment.durationMinutes) || DEFAULT_SERVICE_DURATION_MINUTES;
    return {
      start: startMinutes,
      end: startMinutes + duration + bufferMinutes,
    };
  });

  const breakRanges = normalizeBreaks(dayBreaks);

  const baseSlots = uniqueSlots.filter((slot) => {
    const slotStart = timeToMinutes(slot);
    const slotEnd = slotStart + durationWithBuffer;

    const overlapsBreak = breakRanges.some((range) => slotStart < range.end && slotEnd > range.start);
    if (overlapsBreak) return false;

    return bookedRanges.every((range) => slotEnd <= range.start || slotStart >= range.end);
  });

  const blockedRanges = [...breakRanges, ...bookedRanges].filter((range) => range.end > range.start);

  const getFreeIntervalsForShift = (
    shift: { enabled: boolean; start: string; end: string },
    limits: { startMinutes: number; endMinutes: number; maxEnd: number },
  ) => {
    if (!shift.enabled || limits.startMinutes >= limits.endMinutes) {
      return { intervals: [] as Array<{ start: number; end: number }>, shiftEnd: limits.endMinutes };
    }

    let intervals: Array<{ start: number; end: number }> = [{ start: limits.startMinutes, end: limits.maxEnd }];
    blockedRanges.forEach((range) => {
      intervals = subtractRange(intervals, range);
    });

    return {
      intervals: intervals.filter((interval) => interval.end > interval.start),
      shiftEnd: limits.endMinutes,
    };
  };

  const slotSet = new Set(baseSlots);
  const baseSlotMinutes = baseSlots.map((slot) => timeToMinutes(slot));

  const maybeAddGapSlot = (interval: { start: number; end: number }, shiftEnd: number) => {
    if (interval.start >= shiftEnd) return;
    if (interval.end - interval.start < durationWithBuffer) return;

    const isGridAligned = interval.start % slotIntervalMinutes === 0;
    if (!isGridAligned) {
      slotSet.add(minutesToTime(interval.start));
      return;
    }

    const latestStart = Math.min(interval.end - durationWithBuffer, shiftEnd - 1);
    if (latestStart < interval.start) return;

    const hasGridSlot = baseSlotMinutes.some(
      (slotMinute) => slotMinute >= interval.start && slotMinute <= latestStart,
    );

    if (!hasGridSlot) {
      slotSet.add(minutesToTime(interval.start));
    }
  };

  const morningFree = getFreeIntervalsForShift(daySchedule.morning, morningLimits);
  morningFree.intervals.forEach((interval) => maybeAddGapSlot(interval, morningFree.shiftEnd));

  const afternoonFree = getFreeIntervalsForShift(daySchedule.afternoon, afternoonLimits);
  afternoonFree.intervals.forEach((interval) => maybeAddGapSlot(interval, afternoonFree.shiftEnd));

  return Array.from(slotSet).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
};

export const isDateBlockedByHolidayRanges = (
  dateOnly: string,
  holidayRanges: Array<{ start: string; end: string }>,
) => holidayRanges.some((range) => isDateInRange(dateOnly, range));
