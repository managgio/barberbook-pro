import { ClockPort } from '../../../../shared/application/clock.port';
import { RequestContext } from '../../../../shared/application/request-context';
import { BookingGuestAppointmentReadPort } from '../../ports/outbound/guest-appointment-read.port';
import { GuestAppointmentAccessTokenPort } from '../../ports/outbound/guest-appointment-access-token.port';
import {
  buildGuestAppointmentSummary,
  resolveGuestAppointment,
} from './guest-appointment-access.shared';

export class GetGuestAppointmentAccessUseCase {
  constructor(
    private readonly tokenPort: GuestAppointmentAccessTokenPort,
    private readonly readPort: BookingGuestAppointmentReadPort,
    private readonly clockPort: ClockPort,
  ) {}

  async execute(command: { context: RequestContext; token: string }) {
    const appointment = await resolveGuestAppointment({
      ...command,
      tokenPort: this.tokenPort,
      readPort: this.readPort,
    });
    const cancellationCutoffHours = await this.readPort.getCancellationCutoffHours();
    return buildGuestAppointmentSummary({
      appointment,
      cancellationCutoffHours,
      now: this.clockPort.now(),
      timezone: command.context.timezone,
    });
  }
}
