import { CreateAppointmentCommand } from '../commands/create-appointment.command';
import { BookingCommandPort } from '../../ports/outbound/booking-command.port';
import { BookingUnitOfWorkPort } from '../../ports/outbound/booking-unit-of-work.port';

export class CreateAppointmentUseCase {
  constructor(
    private readonly bookingCommandPort: BookingCommandPort,
    private readonly bookingUnitOfWorkPort: BookingUnitOfWorkPort,
  ) {}

  execute(command: CreateAppointmentCommand): Promise<unknown> {
    return this.bookingUnitOfWorkPort.runInTransaction(
      () => this.bookingCommandPort.createAppointment(command),
      { isolationLevel: 'SERIALIZABLE' },
    );
  }
}
