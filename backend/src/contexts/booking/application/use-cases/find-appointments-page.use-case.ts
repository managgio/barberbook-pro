import { BookingAppointmentQueryPort } from '../../ports/outbound/booking-appointment-query.port';
import { FindAppointmentsPageQuery } from '../queries/find-appointments-page.query';

export class FindAppointmentsPageUseCase {
  constructor(private readonly bookingAppointmentQueryPort: BookingAppointmentQueryPort) {}

  execute(query: FindAppointmentsPageQuery) {
    return this.bookingAppointmentQueryPort.findAppointmentsPage({
      localId: query.context.localId,
      filters: query.filters,
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}
