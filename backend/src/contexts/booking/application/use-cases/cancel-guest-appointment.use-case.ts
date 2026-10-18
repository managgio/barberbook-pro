import { ClockPort } from '../../../../shared/application/clock.port';
import { DistributedLockPort } from '../../../../shared/application/distributed-lock.port';
import { RequestContext } from '../../../../shared/application/request-context';
import { GuestAppointmentCannotCancelError } from '../errors/guest-appointment-access.errors';
import { evaluateGuestAppointmentCancellation } from '../../domain/services/guest-appointment-access.policy';
import { BookingGuestAppointmentReadPort } from '../../ports/outbound/guest-appointment-read.port';
import { GuestAppointmentAccessTokenPort } from '../../ports/outbound/guest-appointment-access-token.port';
import { UpdateAppointmentUseCase } from './update-appointment.use-case';
import {
  buildGuestAppointmentSummary,
  GuestAppointmentAccessSummary,
  resolveGuestAppointment,
} from './guest-appointment-access.shared';

export class CancelGuestAppointmentUseCase {
  constructor(
    private readonly tokenPort: GuestAppointmentAccessTokenPort,
    private readonly readPort: BookingGuestAppointmentReadPort,
    private readonly updateAppointmentUseCase: UpdateAppointmentUseCase,
    private readonly clockPort: ClockPort,
    private readonly distributedLockPort: DistributedLockPort,
  ) {}

  async execute(command: { context: RequestContext; token: string }): Promise<GuestAppointmentAccessSummary> {
    const initial = await resolveGuestAppointment({
      ...command,
      tokenPort: this.tokenPort,
      readPort: this.readPort,
    });
    let result: GuestAppointmentAccessSummary | null = null;

    const executed = await this.distributedLockPort.runWithLock(
      `guest-appointment-cancel:${command.context.brandId}:${command.context.localId}:${initial.id}`,
      async () => {
        const appointment = await resolveGuestAppointment({
          ...command,
          tokenPort: this.tokenPort,
          readPort: this.readPort,
        });
        const cancellationCutoffHours = await this.readPort.getCancellationCutoffHours();
        const now = this.clockPort.now();
        const cancellation = evaluateGuestAppointmentCancellation({
          appointment,
          cancellationCutoffHours,
          now,
        });

        if (appointment.status === 'cancelled') {
          result = buildGuestAppointmentSummary({
            appointment,
            cancellationCutoffHours,
            now,
            timezone: command.context.timezone,
          });
          return;
        }
        if (!cancellation.canCancel) {
          throw new GuestAppointmentCannotCancelError(cancellation.reason);
        }

        await this.updateAppointmentUseCase.execute({
          context: command.context,
          appointmentId: appointment.id,
          input: { status: 'cancelled' },
          execution: { actorUserId: null },
        });

        const cancelledAppointment = await this.readPort.findGuestAppointment({
          localId: command.context.localId,
          appointmentId: appointment.id,
        });
        if (!cancelledAppointment) {
          return;
        }
        result = buildGuestAppointmentSummary({
          appointment: cancelledAppointment,
          cancellationCutoffHours,
          now,
          timezone: command.context.timezone,
        });
      },
      {
        ttlMs: 30_000,
        waitMs: 2_000,
        retryEveryMs: 100,
        onLockedMessage: 'guest appointment cancellation already in progress',
      },
    );

    if (!executed || !result) {
      throw new GuestAppointmentCannotCancelError('operation_in_progress');
    }
    return result;
  }
}
