import { BookingMaintenancePort } from '../../ports/outbound/booking-maintenance.port';
import { SendAppointmentPaymentConfirmationCommand } from '../commands/send-appointment-payment-confirmation.command';

export class SendAppointmentPaymentConfirmationUseCase {
  constructor(private readonly bookingMaintenancePort: BookingMaintenancePort) {}

  execute(command: SendAppointmentPaymentConfirmationCommand): Promise<void> {
    return this.bookingMaintenancePort.sendPaymentConfirmation({
      appointmentId: command.appointmentId,
      localId: command.context.localId,
    });
  }
}
