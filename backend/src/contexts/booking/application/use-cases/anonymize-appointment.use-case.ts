import { AnonymizeAppointmentCommand } from '../commands/anonymize-appointment.command';
import { BookingMaintenancePort } from '../../ports/outbound/booking-maintenance.port';

export class AnonymizeAppointmentUseCase {
  constructor(private readonly bookingMaintenancePort: BookingMaintenancePort) {}

  execute(command: AnonymizeAppointmentCommand): Promise<unknown> {
    return this.bookingMaintenancePort.anonymizeAppointment({
      appointmentId: command.appointmentId,
      actorUserId: command.actorUserId,
      reason: command.reason,
    });
  }
}
