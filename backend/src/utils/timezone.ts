import { DayKey } from '../modules/schedules/schedule.types';

type TimeParts = {
  hour: number;
  minute: number;
  second?: number;
  ms?: number;
};

const pad = (value: number) => value.toString().padStart(2, '0');

export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Europe/Madrid';

const getTimeZoneParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  }
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
  const parts = getTimeZoneParts(date, timeZone);
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

export const makeDateInTimeZone = (dateOnly: string, time: TimeParts, timeZone = APP_TIMEZONE) => {
  const [year, month, day] = dateOnly.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return new Date(NaN);
  }
  const hour = time.hour;
  const minute = time.minute;
  const second = time.second ?? 0;
  const ms = time.ms ?? 0;
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
  const offsetMs = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offsetMs);
};

export const startOfDayInTimeZone = (dateOnly: string, timeZone = APP_TIMEZONE) =>
  makeDateInTimeZone(dateOnly, { hour: 0, minute: 0, second: 0, ms: 0 }, timeZone);

export const endOfDayInTimeZone = (dateOnly: string, timeZone = APP_TIMEZONE) =>
  makeDateInTimeZone(dateOnly, { hour: 23, minute: 59, second: 59, ms: 999 }, timeZone);

export const formatDateInTimeZone = (date: Date, timeZone = APP_TIMEZONE) => {
  const parts = getTimeZoneParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
};

export const formatTimeInTimeZone = (date: Date, timeZone = APP_TIMEZONE) => {
  const parts = getTimeZoneParts(date, timeZone);
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
};

export const getWeekdayKey = (dateOnly: string, timeZone = APP_TIMEZONE): DayKey => {
  const reference = makeDateInTimeZone(dateOnly, { hour: 12, minute: 0 }, timeZone);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' })
    .format(reference)
    .toLowerCase();
  return weekday as DayKey;
};
