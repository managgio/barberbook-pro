import { DateRange, normalizeDateRange } from './date-range';

export type HolidayRange = DateRange;

export const normalizeHolidayRange = (range: HolidayRange): HolidayRange =>
  normalizeDateRange(range);
