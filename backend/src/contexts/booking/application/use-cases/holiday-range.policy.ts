export type HolidayRangeInput = {
  start: string;
  end?: string;
};

export const normalizeHolidayRange = (range: HolidayRangeInput): { start: string; end: string } => {
  const start = String(range.start).split('T')[0];
  const end = String(range.end || range.start).split('T')[0];
  if (start <= end) {
    return { start, end };
  }
  return { start: end, end: start };
};

