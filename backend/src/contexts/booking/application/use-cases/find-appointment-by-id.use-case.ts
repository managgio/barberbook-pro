import { BookingMaintenancePort } from '../../ports/outbound/booking-maintenance.port';
import { BookingAppointmentQueryPort } from '../../ports/outbound/booking-appointment-query.port';
import { FindAppointmentByIdQuery } from '../queries/find-appointment-by-id.query';

export class FindAppointmentByIdUseCase {
  constructor(
    private readonly bookingAppointmentQueryPort: BookingAppointmentQueryPort,
    private readonly bookingMaintenancePort: BookingMaintenancePort,
  ) {}

  async execute(query: FindAppointmentByIdQuery) {
    await this.bookingMaintenancePort.syncStatusesForAppointments({
      appointmentIds: [query.appointmentId],
    });
    return this.bookingAppointmentQueryPort.findAppointmentById({
      localId: query.context.localId,
      appointmentId: query.appointmentId,
    });
  }
}
