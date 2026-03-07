export const BOOKING_DASHBOARD_READ_PORT = Symbol('BOOKING_DASHBOARD_READ_PORT');

export type BookingDashboardBarberSnapshot = {
  id: string;
  name: string;
};

export type BookingDashboardAppointmentSnapshot = {
  id: string;
  startDateTime: Date;
  status: string;
  price: number | null;
  guestName: string | null;
  serviceNameSnapshot: string | null;
  barberNameSnapshot: string | null;
  userName: string | null;
  serviceName: string | null;
  barberName: string | null;
};

export interface BookingDashboardReadPort {
  readDashboardSnapshot(params: {
    localId: string;
    dateFrom: string;
    dateTo: string;
    barberId?: string;
  }): Promise<{
    barbers: BookingDashboardBarberSnapshot[];
    appointments: BookingDashboardAppointmentSnapshot[];
  }>;
}
