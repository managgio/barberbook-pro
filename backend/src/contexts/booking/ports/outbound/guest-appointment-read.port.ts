export const BOOKING_GUEST_APPOINTMENT_READ_PORT = Symbol('BOOKING_GUEST_APPOINTMENT_READ_PORT');

export type BookingGuestAppointmentRecord = {
  id: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  startDateTime: Date;
  durationMinutes: number;
  serviceName: string;
  professionalName: string | null;
};

export interface BookingGuestAppointmentReadPort {
  findGuestAppointment(params: {
    localId: string;
    appointmentId: string;
  }): Promise<BookingGuestAppointmentRecord | null>;
  getCancellationCutoffHours(): Promise<number>;
}
