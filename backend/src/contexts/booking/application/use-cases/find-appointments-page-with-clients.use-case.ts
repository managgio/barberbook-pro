import { BookingAppointmentQueryPort } from '../../ports/outbound/booking-appointment-query.port';
import { FindAppointmentsPageWithClientsQuery } from '../queries/find-appointments-page-with-clients.query';

export class FindAppointmentsPageWithClientsUseCase {
  constructor(private readonly bookingAppointmentQueryPort: BookingAppointmentQueryPort) {}

  execute(query: FindAppointmentsPageWithClientsQuery) {
    return this.bookingAppointmentQueryPort.findAppointmentsPageWithClients({
      localId: query.context.localId,
      filters: query.filters,
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}
