import { CommerceActiveSubscription } from './subscription-policy.port';

export const COMMERCE_SUBSCRIPTION_MANAGEMENT_PORT = Symbol('COMMERCE_SUBSCRIPTION_MANAGEMENT_PORT');

export type CommerceSubscriptionCheckoutMode = 'stripe' | 'next_appointment';

export type CommerceCreateSubscriptionPlanInput = {
  name: string;
  description?: string | null;
  price: number;
  durationValue: number;
  durationUnit: string;
  isActive?: boolean;
  displayOrder?: number;
  availabilityStartDate?: string | null;
  availabilityEndDate?: string | null;
};

export type CommerceUpdateSubscriptionPlanInput = Partial<CommerceCreateSubscriptionPlanInput>;

export type CommerceAssignUserSubscriptionInput = {
  planId: string;
  startDate?: string;
  notes?: string | null;
};

export type CommerceSubscribePlanInput = {
  planId: string;
  paymentMode?: CommerceSubscriptionCheckoutMode;
};

export type CommerceMarkSubscriptionPaidInput = {
  paymentMethod?: string;
  paidAt?: string;
};

export type CommerceSubscriptionPlanView = {
  id: string;
  localId: string;
  name: string;
  description: string | null;
  price: number;
  durationValue: number;
  durationUnit: string;
  isActive: boolean;
  isArchived: boolean;
  availabilityStartDate: string | null;
  availabilityEndDate: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CommerceUserSubscriptionView = {
  id: string;
  localId: string;
  userId: string;
  planId: string;
  status: string;
  source: string;
  startDate: string;
  endDate: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentAmount: number | null;
  paymentCurrency: string | null;
  paymentPaidAt: string | null;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  cancelledAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  plan: CommerceSubscriptionPlanView;
  isActiveNow: boolean;
  isUsableNow: boolean;
  isPaymentSettled: boolean;
};

export type CommerceUserSubscriptionsPage = {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  items: CommerceUserSubscriptionView[];
};

export type CommerceSubscriptionCheckoutResult =
  | {
      mode: 'stripe';
      checkoutUrl: string;
      subscription: CommerceUserSubscriptionView;
    }
  | {
      mode: 'next_appointment';
      checkoutUrl: null;
      subscription: CommerceUserSubscriptionView;
    };

export interface CommerceSubscriptionManagementPort {
  listPlansAdmin(includeArchived?: boolean): Promise<CommerceSubscriptionPlanView[]>;
  listActivePlans(): Promise<CommerceSubscriptionPlanView[]>;
  createPlan(data: CommerceCreateSubscriptionPlanInput): Promise<CommerceSubscriptionPlanView>;
  updatePlan(id: string, data: CommerceUpdateSubscriptionPlanInput): Promise<CommerceSubscriptionPlanView>;
  archivePlan(id: string): Promise<{ success: boolean }>;
  listUserSubscriptions(userId: string): Promise<CommerceUserSubscriptionView[]>;
  listUserSubscriptionsPage(
    userId: string,
    params: { page: number; pageSize: number },
  ): Promise<CommerceUserSubscriptionsPage>;
  getUserActiveSubscription(
    userId: string,
    referenceDateInput?: string,
  ): Promise<CommerceUserSubscriptionView | null>;
  assignUserSubscription(
    userId: string,
    data: CommerceAssignUserSubscriptionInput,
  ): Promise<CommerceUserSubscriptionView>;
  subscribeCurrentUser(
    userId: string,
    data: CommerceSubscribePlanInput,
    baseUrl: string,
  ): Promise<CommerceSubscriptionCheckoutResult>;
  markSubscriptionPaid(
    userId: string,
    subscriptionId: string,
    data: CommerceMarkSubscriptionPaidInput,
  ): Promise<CommerceUserSubscriptionView>;
  settlePendingInPersonPaymentFromAppointment(params: {
    subscriptionId: string | null | undefined;
    paymentMethod: string | null | undefined;
    completedAt?: Date;
  }): Promise<CommerceUserSubscriptionView | null>;
  hasUsableActiveSubscription(userId: string | null | undefined, referenceDate?: Date): Promise<boolean>;
  resolveActiveSubscriptionForAppointment(
    userId: string | null | undefined,
    appointmentDate: Date,
  ): Promise<CommerceActiveSubscription | null>;
}
