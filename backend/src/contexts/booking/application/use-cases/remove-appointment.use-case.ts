import { BookingCommandPort } from '../../ports/outbound/booking-command.port';
import { BookingUnitOfWorkPort } from '../../ports/outbound/booking-unit-of-work.port';
import { RemoveAppointmentCommand } from '../commands/remove-appointment.command';

export class RemoveAppointmentUseCase {
  constructor(
    private readonly bookingCommandPort: BookingCommandPort,
    private readonly bookingUnitOfWorkPort: BookingUnitOfWorkPort,
  ) {}

  execute(command: RemoveAppointmentCommand): Promise<unknown> {
    return this.bookingUnitOfWorkPort.runInTransaction(
      () => this.bookingCommandPort.removeAppointment(command),
      { isolationLevel: 'SERIALIZABLE' },
    );
  }
}
