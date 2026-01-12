import { minutesToTime, timeToMinutes } from '../schedules/schedule.utils';
import { ShopSchedule } from '../schedules/schedule.types';

export const AI_TIME_ZONE = 'Europe/Madrid';
export const DEFAULT_SERVICE_DURATION_MINUTES = 30;
export const SLOT_INTERVAL_MINUTES = 15;
export const DEFAULT_FREE_RANGE_HOURS = 6;

const buildParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = Number(part.value);
    }
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
  const parts = buildParts(date, timeZone);
  const utcTime = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return utcTime - date.getTime();
};

export const getDateStringInTimeZone = (date: Date, timeZone = AI_TIME_ZONE) => {
  const parts = buildParts(date, timeZone);
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
};

export const isValidDateString = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const pad = (value: number) => value.toString().padStart(2, '0');

const buildDateString = (year: number, month: number, day: number) =>
  `${year}-${pad(month)}-${pad(day)}`;

const WEEKDAY_MAP: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

const weekdayIndexInTimeZone = (date: Date, timeZone: string) => {
  const short = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[short] ?? date.getUTCDay();
};

const nextWeekdayDateString = (now: Date, targetIndex: number, timeZone: string, forceNextWeek: boolean) => {
  const currentIndex = weekdayIndexInTimeZone(now, timeZone);
  let daysUntil = (targetIndex - currentIndex + 7) % 7;
  if (forceNextWeek && daysUntil === 0) {
    daysUntil = 7;
  }
  return getDateStringInTimeZone(addDays(now, daysUntil), timeZone);
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const parseDateString = (value: string) => new Date(`${value}T12:00:00Z`);

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const buildDateRangeStrings = (
  startDate: string,
  endDate: string,
  timeZone = AI_TIME_ZONE,
  maxDays = 90,
) => {
  let start = parseDateString(startDate);
  let end = parseDateString(endDate);
  if (start.getTime() > end.getTime()) {
    [start, end] = [end, start];
  }
  const totalDays = Math.min(maxDays, Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1);
  return Array.from({ length: totalDays }).map((_, index) =>
    getDateStringInTimeZone(addDays(start, index), timeZone),
  );
};

export const toDateInTimeZone = (date: string, time: string, timeZone = AI_TIME_ZONE) => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
};

export const getDayBoundsInTimeZone = (dateString: string, timeZone = AI_TIME_ZONE) => {
  const [year, month, day] = dateString.split('-').map(Number);
  const startGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const endGuess = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
  const startOffset = getTimeZoneOffsetMs(startGuess, timeZone);
  const endOffset = getTimeZoneOffsetMs(endGuess, timeZone);
  return {
    start: new Date(startGuess.getTime() - startOffset),
    end: new Date(endGuess.getTime() - endOffset),
  };
};

export const getMinutesInTimeZone = (date: Date, timeZone = AI_TIME_ZONE) => {
  const parts = buildParts(date, timeZone);
  return parts.hour * 60 + parts.minute;
};

export const formatTimeInTimeZone = (date: Date, timeZone = AI_TIME_ZONE) => {
  const parts = buildParts(date, timeZone);
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
};

export const roundUpToInterval = (minutes: number, interval = SLOT_INTERVAL_MINUTES) =>
  Math.ceil(minutes / interval) * interval;

export const clampMinutes = (value: number) => Math.max(0, Math.min(24 * 60 - 1, value));

export const getDayKeyInTimeZone = (dateString: string, timeZone = AI_TIME_ZONE) => {
  const date = new Date(`${dateString}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' })
    .format(date)
    .toLowerCase() as keyof ShopSchedule;
};

export const getScheduleRange = (schedule: ShopSchedule, dateString: string, timeZone = AI_TIME_ZONE) => {
  const dayKey = getDayKeyInTimeZone(dateString, timeZone);
  const daySchedule = schedule[dayKey];
  if (!daySchedule || daySchedule.closed) {
    return null;
  }
  const ranges: { start: number; end: number }[] = [];
  if (daySchedule.morning?.enabled) {
    ranges.push({
      start: timeToMinutes(daySchedule.morning.start),
      end: timeToMinutes(daySchedule.morning.end),
    });
  }
  if (daySchedule.afternoon?.enabled) {
    ranges.push({
      start: timeToMinutes(daySchedule.afternoon.start),
      end: timeToMinutes(daySchedule.afternoon.end),
    });
  }
  if (ranges.length === 0) return null;
  return {
    start: Math.min(...ranges.map((range) => range.start)),
    end: Math.max(...ranges.map((range) => range.end)),
  };
};

export const mergeIntervals = (intervals: { start: number; end: number }[]) => {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
};

export const buildIntervalsFromSlots = (
  slots: string[],
  durationMinutes: number,
  range: { start: number; end: number },
) => {
  const intervals = slots
    .map((slot) => {
      const start = timeToMinutes(slot);
      const end = start + durationMinutes;
      return { start, end };
    })
    .filter((interval) => interval.start >= range.start && interval.end <= range.end);

  return mergeIntervals(intervals)
    .map((interval) => ({
      start: minutesToTime(interval.start),
      end: minutesToTime(interval.end),
    }));
};

export const isSameDay = (dateString: string, date: Date, timeZone = AI_TIME_ZONE) =>
  dateString === getDateStringInTimeZone(date, timeZone);

export const parseDateFromText = (input: string, now: Date, timeZone = AI_TIME_ZONE) => {
  const text = normalizeText(input || '');
  if (!text) return null;

  if (/\bpasado\s+manana\b/.test(text)) {
    return getDateStringInTimeZone(addDays(now, 2), timeZone);
  }
  if (/\bmanana\b/.test(text)) {
    return getDateStringInTimeZone(addDays(now, 1), timeZone);
  }
  if (/\bhoy\b/.test(text)) {
    return getDateStringInTimeZone(now, timeZone);
  }

  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch && isValidDateString(isoMatch[1])) return isoMatch[1];

  const slashMatch = text.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const yearRaw = slashMatch[3];
    const year = yearRaw ? Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw) : undefined;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      if (year) return buildDateString(year, month, day);
      const today = getDateStringInTimeZone(now, timeZone).split('-').map(Number);
      let targetYear = today[0];
      if (month < today[1] || (month === today[1] && day < today[2])) {
        targetYear += 1;
      }
      return buildDateString(targetYear, month, day);
    }
  }

  const monthMap: Record<string, number> = {
    enero: 1,
    febrero: 2,
    marzo: 3,
    abril: 4,
    mayo: 5,
    junio: 6,
    julio: 7,
    agosto: 8,
    septiembre: 9,
    setiembre: 9,
    octubre: 10,
    noviembre: 11,
    diciembre: 12,
  };

  const monthMatch = text.match(/\b(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?\b/);
  if (monthMatch) {
    const day = Number(monthMatch[1]);
    const monthName = monthMatch[2];
    const month = monthMap[monthName];
    if (!month || day < 1 || day > 31) return null;
    const yearMatch = monthMatch[3];
    const today = getDateStringInTimeZone(now, timeZone).split('-').map(Number);
    let targetYear = yearMatch ? Number(yearMatch) : today[0];
    if (!yearMatch) {
      if (month < today[1] || (month === today[1] && day < today[2])) {
        targetYear += 1;
      }
    }
    return buildDateString(targetYear, month, day);
  }

  const dayOnlyMatch = text.match(/\b(?:el|dia|d)\s*(\d{1,2})\b/);
  if (dayOnlyMatch) {
    const day = Number(dayOnlyMatch[1]);
    if (day < 1 || day > 31) return null;
    const [year, month, todayDay] = getDateStringInTimeZone(now, timeZone).split('-').map(Number);
    let targetYear = year;
    let targetMonth = month;
    if (day < todayDay) {
      targetMonth += 1;
      if (targetMonth > 12) {
        targetMonth = 1;
        targetYear += 1;
      }
    }
    return buildDateString(targetYear, targetMonth, day);
  }

  const weekdayMatch = text.match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
  if (weekdayMatch) {
    const targetIndex = WEEKDAY_MAP[weekdayMatch[1]];
    const forceNextWeek = /\b(que viene|proximo|siguiente|semana que viene)\b/.test(text);
    return nextWeekdayDateString(now, targetIndex, timeZone, forceNextWeek);
  }

  return null;
};

export const parseDateRangeFromText = (input: string, now: Date, timeZone = AI_TIME_ZONE) => {
  const text = normalizeText(input || '');
  if (!text) return null;

  if (/\b(semana que viene|proxima semana|siguiente semana)\b/.test(text)) {
    const start = nextWeekdayDateString(now, WEEKDAY_MAP.lunes, timeZone, true);
    const end = getDateStringInTimeZone(addDays(parseDateString(start), 6), timeZone);
    return { start, end };
  }

  const isoMatches = text.match(/\b\d{4}-\d{2}-\d{2}\b/g);
  if (isoMatches && isoMatches.length >= 2) {
    const [start, end] = isoMatches;
    return { start, end };
  }

  const rangeMonthMatch = text.match(
    /\b(?:del?\s+)?(\d{1,2})\s*(?:y|al|a)\s*(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?\b/,
  );
  if (rangeMonthMatch) {
    const startDay = Number(rangeMonthMatch[1]);
    const endDay = Number(rangeMonthMatch[2]);
    const monthName = rangeMonthMatch[3];
    const yearRaw = rangeMonthMatch[4];
    const monthMap: Record<string, number> = {
      enero: 1,
      febrero: 2,
      marzo: 3,
      abril: 4,
      mayo: 5,
      junio: 6,
      julio: 7,
      agosto: 8,
      septiembre: 9,
      setiembre: 9,
      octubre: 10,
      noviembre: 11,
      diciembre: 12,
    };
    const month = monthMap[monthName];
    if (month && startDay >= 1 && endDay >= 1 && startDay <= 31 && endDay <= 31) {
      const today = getDateStringInTimeZone(now, timeZone).split('-').map(Number);
      let year = yearRaw ? Number(yearRaw) : today[0];
      if (!yearRaw) {
        const minDay = Math.min(startDay, endDay);
        if (month < today[1] || (month === today[1] && minDay < today[2])) {
          year += 1;
        }
      }
      const start = buildDateString(year, month, startDay);
      const end = buildDateString(year, month, endDay);
      return start <= end ? { start, end } : { start: end, end: start };
    }
  }

  const slashMatches = Array.from(text.matchAll(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/g));
  if (slashMatches.length >= 2) {
    const start = parseDateFromText(slashMatches[0][0], now, timeZone);
    const end = parseDateFromText(slashMatches[1][0], now, timeZone);
    if (start && end) {
      return start <= end ? { start, end } : { start: end, end: start };
    }
  }

  const firstDate = parseDateFromText(text, now, timeZone);
  if (!firstDate) return null;
  const rest = text.replace(firstDate, '');
  const secondDate = parseDateFromText(rest, now, timeZone);
  if (secondDate) {
    return firstDate <= secondDate ? { start: firstDate, end: secondDate } : { start: secondDate, end: firstDate };
  }

  return { start: firstDate, end: firstDate };
};

export const parseTimeFromText = (input: string) => {
  const text = normalizeText(input || '');
  if (!text) return null;

  const timeMatch = text.match(/\b(\d{1,2})\s*[:.h]\s*(\d{2})\b/);
  if (timeMatch) {
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${pad(hour)}:${pad(minute)}`;
    }
  }

  const adjustHour = (hour: number, period: string | undefined) => {
    if (!period) return hour;
    if ((period.includes('tarde') || period.includes('noche') || period.includes('pm')) && hour < 12) {
      return hour + 12;
    }
    if ((period.includes('manana') || period.includes('am')) && hour === 12) {
      return 0;
    }
    return hour;
  };

  const phraseMatch = text.match(
    /\b(?:a\s+las|las)\s*(\d{1,2})(?:\s*[:.h]\s*(\d{2}))?\s*(de la manana|de la tarde|de la noche)?\b/,
  );
  if (phraseMatch) {
    const hourRaw = Number(phraseMatch[1]);
    const minute = phraseMatch[2] ? Number(phraseMatch[2]) : 0;
    const period = phraseMatch[3];
    if (hourRaw >= 0 && hourRaw <= 23 && minute >= 0 && minute <= 59) {
      const hour = adjustHour(hourRaw, period);
      return `${pad(hour)}:${pad(minute)}`;
    }
  }

  const periodMatch = text.match(
    /\b(\d{1,2})(?:\s*[:.h]\s*(\d{2}))?\s*(am|a\.m\.|pm|p\.m\.|de la manana|de la tarde|de la noche)\b/,
  );
  if (periodMatch) {
    const hourRaw = Number(periodMatch[1]);
    const minute = periodMatch[2] ? Number(periodMatch[2]) : 0;
    const period = periodMatch[3]?.replace(/\./g, '');
    if (hourRaw >= 0 && hourRaw <= 23 && minute >= 0 && minute <= 59) {
      const hour = adjustHour(hourRaw, period);
      return `${pad(hour)}:${pad(minute)}`;
    }
  }

  return null;
};
