export const COMMERCE_PAYMENT_MANAGEMENT_PORT = Symbol('COMMERCE_PAYMENT_MANAGEMENT_PORT');

export type CommerceOnlinePaymentScope = 'brand' | 'location';

export type CommerceOnlineCheckoutProductInput = {
  productId: string;
  quantity: number;
};

export type CommerceCreateOnlinePaymentCheckoutInput = {
  userId?: string | null;
  barberId: string;
  serviceId: string;
  startDateTime: string;
  notes?: string;
  guestName?: string;
  guestContact?: string;
  privacyConsentGiven?: boolean;
  referralAttributionId?: string;
  appliedCouponId?: string;
  useWallet?: boolean;
  products?: CommerceOnlineCheckoutProductInput[];
};

export type CommerceOnlinePaymentAvailability = {
  enabled: boolean;
  reason?: string;
  mode?: CommerceOnlinePaymentScope;
  status?: {
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  } | null;
  publishableKey?: string | null;
};

export type CommerceOnlinePaymentAdminConfig = {
  mode: CommerceOnlinePaymentScope;
  brandEnabled: boolean;
  platformEnabled: boolean;
  localEnabled: boolean;
  accountIdExists: boolean;
  status: {
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  } | null;
};

export type CommerceOnlinePaymentOnboardingResult = {
  url: string;
  accountId: string;
};

export type CommerceOnlinePaymentCheckoutResult =
  | { mode: 'exempt'; appointmentId: string }
  | { mode: 'stripe'; checkoutUrl: string | null; appointmentId: string };

export type CommerceOnlineCheckoutSessionView = {
  id: string;
  url: string | null;
  status: string | null;
  payment_status: string | null;
  payment_intent: string | null;
  amount_total: number | null;
  currency: string | null;
  metadata: Record<string, string>;
  client_reference_id: string | null;
};

export type CommerceOnlinePaymentIntentView = {
  id: string;
  amount_received: number | null;
  currency: string | null;
};

export type CommerceOnlinePaymentWebhookEvent = {
  type: string;
  data: {
    object: CommerceOnlineCheckoutSessionView | CommerceOnlinePaymentIntentView | Record<string, unknown>;
  };
};

export interface CommercePaymentManagementPort {
  getStripeAvailability(params: {
    brandId: string;
    localId: string;
    publishableKey: string | null;
  }): Promise<CommerceOnlinePaymentAvailability>;
  getAdminStripeConfig(params: { brandId: string; localId: string }): Promise<CommerceOnlinePaymentAdminConfig>;
  updateLocalStripeEnabled(params: {
    brandId: string;
    localId: string;
    enabled: boolean;
  }): Promise<{ enabled: boolean }>;
  createStripeOnboardingLink(params: {
    scope: CommerceOnlinePaymentScope;
    scopeId: string;
    baseUrl: string;
    country: string;
  }): Promise<CommerceOnlinePaymentOnboardingResult>;
  createStripeCheckoutSession(params: {
    brandId: string;
    localId: string;
    data: CommerceCreateOnlinePaymentCheckoutInput;
    baseUrl: string;
    defaultCurrency: string;
    paymentTtlMinutes: number;
    requestMeta?: {
      ip?: string | null;
      userAgent?: string | null;
    };
  }): Promise<CommerceOnlinePaymentCheckoutResult>;
  fetchStripeSession(params: {
    sessionId: string;
  }): Promise<CommerceOnlineCheckoutSessionView>;
  constructWebhookEvent(params: {
    rawBody: Buffer;
    signature?: string;
    webhookSecret?: string;
  }): CommerceOnlinePaymentWebhookEvent;
}
