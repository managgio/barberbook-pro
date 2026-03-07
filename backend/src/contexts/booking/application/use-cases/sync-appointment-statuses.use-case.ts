import { BookingMaintenancePort } from '../../ports/outbound/booking-maintenance.port';

export class SyncAppointmentStatusesUseCase {
  constructor(private readonly bookingMaintenancePort: BookingMaintenancePort) {}

  execute(): Promise<number> {
    return this.bookingMaintenancePort.syncStatusesForAllAppointments();
  }
}
