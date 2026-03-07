export const COMMERCE_STRIPE_PAYMENT_GATEWAY_PORT = Symbol('COMMERCE_STRIPE_PAYMENT_GATEWAY_PORT');

export type CommerceStripeAccountStatus = {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
};

export type CommerceStripeCheckoutSession = {
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

export type CommerceStripePaymentIntent = {
  id: string;
  amount_received: number | null;
  currency: string | null;
};

export type CommerceStripeWebhookEvent = {
  type: string;
  data: {
    object: CommerceStripeCheckoutSession | CommerceStripePaymentIntent | Record<string, unknown>;
  };
};

export interface CommerceStripePaymentGatewayPort {
  getAccountStatus(params: { accountId: string }): Promise<CommerceStripeAccountStatus>;
  createExpressAccount(params: {
    country: string;
    businessName: string;
    productDescription: string;
  }): Promise<{ id: string }>;
  createAccountLink(params: {
    accountId: string;
    refreshUrl: string;
    returnUrl: string;
  }): Promise<{ url: string }>;
  createCheckoutSession(params: {
    accountId: string;
    currency: string;
    unitAmount: number;
    serviceName: string;
    customerEmail?: string | null;
    clientReferenceId: string;
    metadata: Record<string, string>;
    expiresAt?: number;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CommerceStripeCheckoutSession>;
  retrieveCheckoutSession(params: {
    sessionId: string;
    accountId?: string;
  }): Promise<CommerceStripeCheckoutSession>;
  constructWebhookEvent(params: {
    rawBody: Buffer;
    signature?: string;
    webhookSecret?: string;
  }): CommerceStripeWebhookEvent;
}
