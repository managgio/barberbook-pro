export type DateRange = {
  start: string;
  end: string;
};

export const toIsoDateOnly = (value: string) => value.split('T')[0];

export const normalizeDateRange = (range: DateRange): DateRange => {
  const start = toIsoDateOnly(range.start);
  const end = toIsoDateOnly(range.end || range.start);
  if (start <= end) {
    return { start, end };
  }
  return { start: end, end: start };
};

export const isDateInRange = (dateOnly: string, range: DateRange) =>
  dateOnly >= range.start && dateOnly <= range.end;
