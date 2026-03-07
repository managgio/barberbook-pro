import { BookingCommandPort } from '../../ports/outbound/booking-command.port';
import { BookingUnitOfWorkPort } from '../../ports/outbound/booking-unit-of-work.port';
import { UpdateAppointmentCommand } from '../commands/update-appointment.command';

export class UpdateAppointmentUseCase {
  constructor(
    private readonly bookingCommandPort: BookingCommandPort,
    private readonly bookingUnitOfWorkPort: BookingUnitOfWorkPort,
  ) {}

  execute(command: UpdateAppointmentCommand): Promise<unknown> {
    return this.bookingUnitOfWorkPort.runInTransaction(
      () => this.bookingCommandPort.updateAppointment(command),
      { isolationLevel: 'SERIALIZABLE' },
    );
  }
}
