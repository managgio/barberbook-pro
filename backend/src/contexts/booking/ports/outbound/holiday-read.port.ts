export const HOLIDAY_READ_PORT = Symbol('HOLIDAY_READ_PORT');

export type HolidayRangeRecord = {
  start: string;
  end: string;
};

export interface HolidayReadPort {
  getGeneralHolidays(params: { localId: string }): Promise<HolidayRangeRecord[]>;
  getBarberHolidays(params: { localId: string; barberId: string }): Promise<HolidayRangeRecord[]>;
  getBarberHolidaysByBarberIds(params: {
    localId: string;
    barberIds: string[];
  }): Promise<Record<string, HolidayRangeRecord[]>>;
}
