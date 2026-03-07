export const BOOKING_AVAILABILITY_READ_PORT = Symbol('BOOKING_AVAILABILITY_READ_PORT');

export type BookingAppointmentSlotRecord = {
  barberId: string;
  startDateTime: Date;
  serviceDurationMinutes?: number | null;
};

export interface BookingAvailabilityReadPort {
  listAppointmentsForBarberDay(params: {
    localId: string;
    barberId: string;
    dateOnly: string;
    appointmentIdToIgnore?: string;
  }): Promise<BookingAppointmentSlotRecord[]>;

  listAppointmentsForBarbersDay(params: {
    localId: string;
    barberIds: string[];
    dateOnly: string;
    appointmentIdToIgnore?: string;
  }): Promise<BookingAppointmentSlotRecord[]>;

  countWeeklyLoad(params: {
    localId: string;
    dateFrom: string;
    dateTo: string;
    barberIds?: string[];
  }): Promise<Record<string, number>>;
}
