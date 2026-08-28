export const BOOKING_AVAILABILITY_READ_PORT = Symbol('BOOKING_AVAILABILITY_READ_PORT');

export type BookingAppointmentSlotRecord = {
  barberId: string;
  startDateTime: Date;
  serviceDurationMinutes?: number | null;
};

export type BookingClosureSlotRecord = {
  barberId: string | null;
  startDateTime: Date;
  endDateTime: Date;
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

  listClosuresForBarberDay?(params: {
    localId: string;
    barberId: string;
    dateOnly: string;
  }): Promise<BookingClosureSlotRecord[]>;

  listClosuresForBarbersDay?(params: {
    localId: string;
    barberIds: string[];
    dateOnly: string;
  }): Promise<BookingClosureSlotRecord[]>;

  countWeeklyLoad(params: {
    localId: string;
    dateFrom: string;
    dateTo: string;
    barberIds?: string[];
  }): Promise<Record<string, number>>;
}
