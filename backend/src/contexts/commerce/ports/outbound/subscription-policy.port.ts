export const COMMERCE_SUBSCRIPTION_POLICY_PORT = Symbol('COMMERCE_SUBSCRIPTION_POLICY_PORT');

export type CommerceActiveSubscription = {
  subscriptionId: string;
  planId: string;
  planName: string;
  paymentStatus: string;
  startDate: Date;
  endDate: Date;
};

export interface CommerceSubscriptionPolicyPort {
  resolveActiveSubscriptionForAppointment(
    userId: string | null | undefined,
    appointmentDate: Date,
  ): Promise<CommerceActiveSubscription | null>;
  hasUsableActiveSubscription(userId: string | null | undefined, referenceDate?: Date): Promise<boolean>;
  settlePendingInPersonPaymentFromAppointment(params: {
    subscriptionId: string | null | undefined;
    paymentMethod: string | null | undefined;
    completedAt?: Date;
  }): Promise<void>;
}
