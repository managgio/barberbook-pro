export const BOOKING_APPOINTMENT_QUERY_PORT = Symbol('BOOKING_APPOINTMENT_QUERY_PORT');

export type BookingAppointmentListFilters = {
  userId?: string;
  barberId?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: 'asc' | 'desc';
};

export type BookingAppointmentClient = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

export interface BookingAppointmentQueryPort {
  findAppointmentsPage(params: {
    localId: string;
    filters: BookingAppointmentListFilters;
    page: number;
    pageSize: number;
  }): Promise<{
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    items: unknown[];
  }>;
  findAppointmentsPageWithClients(params: {
    localId: string;
    filters: BookingAppointmentListFilters;
    page: number;
    pageSize: number;
  }): Promise<{
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    items: unknown[];
    clients: BookingAppointmentClient[];
  }>;
  findAppointmentsRangeWithClients(params: {
    localId: string;
    filters: BookingAppointmentListFilters;
  }): Promise<{
    items: unknown[];
    clients: BookingAppointmentClient[];
  }>;
  findAppointmentById(params: {
    localId: string;
    appointmentId: string;
  }): Promise<unknown>;
}
