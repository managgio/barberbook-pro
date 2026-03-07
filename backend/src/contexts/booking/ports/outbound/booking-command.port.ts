import { CreateAppointmentCommand } from '../../application/commands/create-appointment.command';
import { RemoveAppointmentCommand } from '../../application/commands/remove-appointment.command';
import { UpdateAppointmentCommand } from '../../application/commands/update-appointment.command';

export const BOOKING_COMMAND_PORT = Symbol('BOOKING_COMMAND_PORT');

export interface BookingCommandPort {
  createAppointment(command: CreateAppointmentCommand): Promise<unknown>;
  updateAppointment(command: UpdateAppointmentCommand): Promise<unknown>;
  removeAppointment(command: RemoveAppointmentCommand): Promise<unknown>;
}
