import { RequestContext } from '../../../../shared/application/request-context';
import { BookingAppointmentListFilters } from '../../ports/outbound/booking-appointment-query.port';

export type FindAppointmentsPageQuery = {
  context: RequestContext;
  filters: BookingAppointmentListFilters;
  page: number;
  pageSize: number;
};
