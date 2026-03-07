export const BOOKING_STATUS_SIDE_EFFECTS_PORT = Symbol('BOOKING_STATUS_SIDE_EFFECTS_PORT');

export type BookingSettlementContext = {
  subscriptionId: string | null;
  paymentMethod: string | null;
};

export interface BookingStatusSideEffectsPort {
  confirmWalletHold(appointmentId: string): Promise<void>;
  confirmCouponUsage(appointmentId: string): Promise<void>;
  releaseWalletHold(appointmentId: string): Promise<void>;
  cancelCouponUsage(appointmentId: string): Promise<void>;
  handleReferralCompleted(appointmentId: string): Promise<void>;
  handleReferralCancelled(appointmentId: string): Promise<void>;
  handleReviewCompleted(appointmentId: string): Promise<void>;
  getAppointmentSettlementContext(params: {
    localId: string;
    appointmentId: string;
  }): Promise<BookingSettlementContext | null>;
  settleSubscriptionInPersonPayment(params: BookingSettlementContext): Promise<void>;
}
