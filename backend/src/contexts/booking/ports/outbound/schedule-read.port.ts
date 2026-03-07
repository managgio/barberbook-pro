import { BookingSchedulePolicy } from '../../domain/value-objects/schedule';

export const SCHEDULE_POLICY_READ_PORT = Symbol('SCHEDULE_POLICY_READ_PORT');

export interface SchedulePolicyReadPort {
  getShopSchedule(params: { localId: string }): Promise<BookingSchedulePolicy>;
  getBarberSchedule(params: { localId: string; barberId: string }): Promise<BookingSchedulePolicy>;
  getBarberSchedules(params: { localId: string; barberIds: string[] }): Promise<Record<string, BookingSchedulePolicy>>;
}
