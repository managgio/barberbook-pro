import { BookingIdempotencyPort } from '../../ports/outbound/booking-idempotency.port';
import {
  BookingStatusSideEffectsPort,
  BookingSettlementContext,
} from '../../ports/outbound/booking-status-side-effects.port';

export type BookingStatusSideEffectsStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export type RunAppointmentStatusSideEffectsCommand = {
  localId: string;
  appointmentId: string;
  nextStatus: BookingStatusSideEffectsStatus;
};

export type RunAppointmentStatusSideEffectsResult = {
  failures: Array<{ effect: string; message: string }>;
};

export class RunAppointmentStatusSideEffectsUseCase {
  constructor(
    private readonly sideEffectsPort: BookingStatusSideEffectsPort,
    private readonly idempotencyPort: BookingIdempotencyPort,
  ) {}

  private buildEffects(command: RunAppointmentStatusSideEffectsCommand): Array<{ name: string; run: () => Promise<void> }> {
    const effects: Array<{ name: string; run: () => Promise<void> }> = [];

    if (command.nextStatus === 'completed') {
      effects.push(
        { name: 'confirmWalletHold', run: () => this.sideEffectsPort.confirmWalletHold(command.appointmentId) },
        { name: 'confirmCouponUsage', run: () => this.sideEffectsPort.confirmCouponUsage(command.appointmentId) },
        {
          name: 'handleReferralCompleted',
          run: () => this.sideEffectsPort.handleReferralCompleted(command.appointmentId),
        },
        {
          name: 'settleSubscriptionInPersonPayment',
          run: async () => {
            const settlement = await this.sideEffectsPort.getAppointmentSettlementContext({
              localId: command.localId,
              appointmentId: command.appointmentId,
            });
            if (!settlement) return;
            await this.sideEffectsPort.settleSubscriptionInPersonPayment(settlement as BookingSettlementContext);
          },
        },
        {
          name: 'handleReviewCompleted',
          run: () => this.sideEffectsPort.handleReviewCompleted(command.appointmentId),
        },
      );
    }

    if (command.nextStatus === 'cancelled' || command.nextStatus === 'no_show') {
      effects.push(
        { name: 'releaseWalletHold', run: () => this.sideEffectsPort.releaseWalletHold(command.appointmentId) },
        { name: 'cancelCouponUsage', run: () => this.sideEffectsPort.cancelCouponUsage(command.appointmentId) },
        {
          name: 'handleReferralCancelled',
          run: () => this.sideEffectsPort.handleReferralCancelled(command.appointmentId),
        },
      );
    }

    return effects;
  }

  async execute(command: RunAppointmentStatusSideEffectsCommand): Promise<RunAppointmentStatusSideEffectsResult> {
    const effects = this.buildEffects(command);
    const failures: Array<{ effect: string; message: string }> = [];

    for (const effect of effects) {
      const key = `booking:status:${command.localId}:${command.appointmentId}:${command.nextStatus}:${effect.name}`;
      try {
        await this.idempotencyPort.runOnce(key, effect.run);
      } catch (error) {
        failures.push({
          effect: effect.name,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { failures };
  }
}
