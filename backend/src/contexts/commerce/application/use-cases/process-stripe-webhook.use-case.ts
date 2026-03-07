import { CommercePaymentLifecyclePort } from '../../ports/outbound/payment-lifecycle.port';

type StripeCheckoutSessionPayload = {
  amount_total: number | null;
  currency: string | null;
  metadata?: Record<string, string>;
  client_reference_id: string | null;
};

type StripePaymentIntentPayload = {
  id: string;
  amount_received: number | null;
  currency: string | null;
};

export class ProcessStripeWebhookUseCase {
  constructor(
    private readonly paymentLifecyclePort: CommercePaymentLifecyclePort,
    private readonly defaultCurrency: string,
  ) {}

  async handleCheckoutCompleted(session: StripeCheckoutSessionPayload) {
    const appointmentId = session.metadata?.appointmentId;
    const now = new Date();
    if (appointmentId) {
      const appointment = await this.paymentLifecyclePort.findAppointmentById(appointmentId);
      if (!appointment || appointment.status === 'cancelled') return;

      await this.paymentLifecyclePort.markAppointmentPaid({
        appointmentId: appointment.id,
        localId: appointment.localId,
        brandId: appointment.brandId,
        amountTotal: this.toAmountTotal(session.amount_total),
        currency: session.currency || this.defaultCurrency,
        paidAt: now,
      });
      return;
    }

    const subscriptionId = session.metadata?.subscriptionId || session.client_reference_id;
    if (!subscriptionId) return;
    await this.paymentLifecyclePort.markSubscriptionPaidById({
      subscriptionId,
      amountTotal: this.toAmountTotal(session.amount_total),
      currency: session.currency || this.defaultCurrency,
      paidAt: now,
    });
  }

  async handleCheckoutExpired(session: StripeCheckoutSessionPayload) {
    const appointmentId = session.metadata?.appointmentId;
    const now = new Date();
    if (appointmentId) {
      await this.cancelPendingAppointment(appointmentId, 'stripe_expired', now);
      return;
    }

    const subscriptionId = session.metadata?.subscriptionId || session.client_reference_id;
    if (!subscriptionId) return;
    await this.paymentLifecyclePort.cancelPendingSubscriptionById({
      subscriptionId,
      cancelledAt: now,
    });
  }

  async handlePaymentFailed(intent: StripePaymentIntentPayload) {
    const now = new Date();
    const appointment = await this.paymentLifecyclePort.findAppointmentByPaymentIntent(intent.id);
    if (appointment) {
      await this.cancelPendingAppointment(appointment.id, 'stripe_payment_failed', now);
      return;
    }
    await this.paymentLifecyclePort.failPendingSubscriptionByPaymentIntent({
      paymentIntentId: intent.id,
      failedAt: now,
    });
  }

  async handlePaymentSucceeded(intent: StripePaymentIntentPayload) {
    const now = new Date();
    const appointment = await this.paymentLifecyclePort.findAppointmentByPaymentIntent(intent.id);
    if (appointment && appointment.paymentStatus !== 'paid') {
      await this.paymentLifecyclePort.markAppointmentPaid({
        appointmentId: appointment.id,
        localId: appointment.localId,
        brandId: appointment.brandId,
        amountTotal: this.toAmountTotal(intent.amount_received),
        currency: intent.currency || this.defaultCurrency,
        paidAt: now,
      });
      return;
    }

    await this.paymentLifecyclePort.markSubscriptionPaidByPaymentIntent({
      paymentIntentId: intent.id,
      amountTotal: this.toAmountTotal(intent.amount_received),
      currency: intent.currency || this.defaultCurrency,
      paidAt: now,
    });
  }

  async cancelExpiredStripePayments(params: { localId: string; now: Date }) {
    const appointmentIds = await this.paymentLifecyclePort.findExpiredPendingAppointmentIds(params);
    let cancelled = 0;
    for (const appointmentId of appointmentIds) {
      const wasCancelled = await this.cancelPendingAppointment(appointmentId, 'stripe_timeout', params.now);
      if (wasCancelled) cancelled += 1;
    }
    return { cancelled };
  }

  async cancelPendingAppointmentById(params: {
    appointmentId: string;
    reason: string;
    cancelledAt?: Date;
  }) {
    return this.cancelPendingAppointment(
      params.appointmentId,
      params.reason,
      params.cancelledAt || new Date(),
    );
  }

  private async cancelPendingAppointment(appointmentId: string, reason: string, cancelledAt: Date) {
    const appointment = await this.paymentLifecyclePort.findAppointmentById(appointmentId);
    if (!appointment) return false;
    if (appointment.status === 'cancelled' || appointment.status === 'completed') return false;
    if (appointment.paymentStatus === 'paid') return false;

    await this.paymentLifecyclePort.cancelAppointmentPaymentAndBooking({
      appointmentId,
      localId: appointment.localId,
      brandId: appointment.brandId,
      reason,
      cancelledAt,
    });
    return true;
  }

  private toAmountTotal(amountInCents: number | null | undefined): number | null {
    if (typeof amountInCents !== 'number') return null;
    return amountInCents / 100;
  }
}
