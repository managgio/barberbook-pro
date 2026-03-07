import { getWeekdayKey } from '../../../../utils/timezone';

export type DayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type ShiftSchedule = {
  enabled: boolean;
  start: string;
  end: string;
};

export type DaySchedule = {
  closed: boolean;
  morning: ShiftSchedule;
  afternoon: ShiftSchedule;
};

export type BreakRange = {
  start: string;
  end: string;
};

export type BreakSchedule = Record<DayKey, BreakRange[]>;
export type BreakScheduleByDate = Record<string, BreakRange[]>;

export type BookingSchedulePolicy = {
  bufferMinutes?: number;
  endOverflowMinutes?: number;
  endOverflowByDay?: Partial<Record<DayKey, number>>;
  endOverflowByDate?: Record<string, number>;
  breaks?: BreakSchedule;
  breaksByDate?: BreakScheduleByDate;
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
};

export const resolveDayKey = (dateOnly: string, timezone: string): DayKey =>
  getWeekdayKey(dateOnly, timezone);
