import { RequestContext } from '../../../../shared/application/request-context';
import { BookingAppointmentListFilters } from '../../ports/outbound/booking-appointment-query.port';

export type FindAppointmentsRangeWithClientsQuery = {
  context: RequestContext;
  filters: BookingAppointmentListFilters;
};
