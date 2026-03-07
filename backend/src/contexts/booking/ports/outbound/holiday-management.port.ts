import { HolidayRangeRecord } from './holiday-read.port';

export const HOLIDAY_MANAGEMENT_PORT = Symbol('HOLIDAY_MANAGEMENT_PORT');

export interface HolidayManagementPort {
  getGeneralHolidays(params: { localId: string }): Promise<HolidayRangeRecord[]>;
  addGeneralHolidayIfMissing(params: { localId: string; start: string; end: string }): Promise<void>;
  removeGeneralHoliday(params: { localId: string; start: string; end: string }): Promise<void>;

  getBarberHolidays(params: { localId: string; barberId: string }): Promise<HolidayRangeRecord[]>;
  addBarberHolidayIfMissing(params: { localId: string; barberId: string; start: string; end: string }): Promise<void>;
  removeBarberHoliday(params: { localId: string; barberId: string; start: string; end: string }): Promise<void>;
}

