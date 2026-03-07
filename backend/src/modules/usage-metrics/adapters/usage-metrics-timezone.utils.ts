export const AI_TIME_ZONE = 'Europe/Madrid';

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

export const parseDateString = (value: string) => new Date(`${value}T12:00:00Z`);

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
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

