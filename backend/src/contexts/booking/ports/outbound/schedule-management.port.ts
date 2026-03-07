import { BookingSchedulePolicy } from '../../domain/value-objects/schedule';

export const SCHEDULE_MANAGEMENT_PORT = Symbol('SCHEDULE_MANAGEMENT_PORT');

export interface ScheduleManagementPort {
  getShopSchedule(params: { localId: string }): Promise<BookingSchedulePolicy>;
  updateShopSchedule(params: { localId: string; schedule: BookingSchedulePolicy }): Promise<BookingSchedulePolicy>;

  getBarberSchedule(params: { localId: string; barberId: string }): Promise<BookingSchedulePolicy>;
  updateBarberSchedule(params: {
    localId: string;
    barberId: string;
    schedule: BookingSchedulePolicy;
  }): Promise<BookingSchedulePolicy>;
}

