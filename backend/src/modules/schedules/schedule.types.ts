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

export type ShopSchedule = {
  bufferMinutes?: number;
  endOverflowMinutes?: number;
  breaks?: BreakSchedule;
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
};

export type HolidayRange = {
  start: string;
  end: string;
};

export const DEFAULT_SHOP_SCHEDULE: ShopSchedule = {
  bufferMinutes: 0,
  endOverflowMinutes: 0,
  breaks: {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  },
  monday: createDaySchedule(['09:00', '14:00'], ['15:00', '20:00']),
  tuesday: createDaySchedule(['09:00', '14:00'], ['15:00', '20:00']),
  wednesday: createDaySchedule(['09:00', '14:00'], ['15:00', '20:00']),
  thursday: createDaySchedule(['09:00', '14:00'], ['15:00', '20:00']),
  friday: createDaySchedule(['09:00', '14:00'], ['15:00', '21:00']),
  saturday: createDaySchedule(['09:30', '13:30'], ['15:30', '18:00']),
  sunday: createDaySchedule(null, null),
};

function createDaySchedule(
  morning: [string, string] | null,
  afternoon: [string, string] | null,
): DaySchedule {
  return {
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
  };
}
