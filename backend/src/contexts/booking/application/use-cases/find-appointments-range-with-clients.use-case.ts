import { BookingAppointmentQueryPort } from '../../ports/outbound/booking-appointment-query.port';
import { FindAppointmentsRangeWithClientsQuery } from '../queries/find-appointments-range-with-clients.query';

export class FindAppointmentsRangeWithClientsUseCase {
  constructor(private readonly bookingAppointmentQueryPort: BookingAppointmentQueryPort) {}

  execute(query: FindAppointmentsRangeWithClientsQuery) {
    return this.bookingAppointmentQueryPort.findAppointmentsRangeWithClients({
      localId: query.context.localId,
      filters: query.filters,
    });
  }
}
