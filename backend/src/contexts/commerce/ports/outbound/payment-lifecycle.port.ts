export const COMMERCE_PAYMENT_LIFECYCLE_PORT = Symbol('COMMERCE_PAYMENT_LIFECYCLE_PORT');

export type CommerceAppointmentPaymentLifecycleState = {
  id: string;
  localId: string;
  brandId: string;
  status: string;
  paymentStatus: string;
};

export interface CommercePaymentLifecyclePort {
  findAppointmentById(appointmentId: string): Promise<CommerceAppointmentPaymentLifecycleState | null>;
  findAppointmentByPaymentIntent(
    paymentIntentId: string,
  ): Promise<CommerceAppointmentPaymentLifecycleState | null>;
  findExpiredPendingAppointmentIds(params: { localId: string; now: Date }): Promise<string[]>;
  markAppointmentPaid(params: {
    appointmentId: string;
    localId: string;
    brandId: string;
    amountTotal: number | null;
    currency: string;
    paidAt: Date;
  }): Promise<void>;
  cancelAppointmentPaymentAndBooking(params: {
    appointmentId: string;
    localId: string;
    brandId: string;
    reason: string;
    cancelledAt: Date;
  }): Promise<void>;
  markSubscriptionPaidById(params: {
    subscriptionId: string;
    amountTotal: number | null;
    currency: string;
    paidAt: Date;
  }): Promise<void>;
  cancelPendingSubscriptionById(params: { subscriptionId: string; cancelledAt: Date }): Promise<void>;
  failPendingSubscriptionByPaymentIntent(params: {
    paymentIntentId: string;
    failedAt: Date;
  }): Promise<void>;
  markSubscriptionPaidByPaymentIntent(params: {
    paymentIntentId: string;
    amountTotal: number | null;
    currency: string;
    paidAt: Date;
  }): Promise<void>;
}
