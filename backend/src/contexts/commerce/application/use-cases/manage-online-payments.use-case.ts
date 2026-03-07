import {
  CommerceCreateOnlinePaymentCheckoutInput,
  CommerceOnlinePaymentScope,
  CommercePaymentManagementPort,
} from '../../ports/outbound/payment-management.port';

export class ManageOnlinePaymentsUseCase {
  constructor(
    private readonly paymentManagementPort: CommercePaymentManagementPort,
  ) {}

  getStripeAvailability(params: {
    brandId: string;
    localId: string;
    publishableKey: string | null;
  }) {
    return this.paymentManagementPort.getStripeAvailability(params);
  }

  getAdminStripeConfig(params: { brandId: string; localId: string }) {
    return this.paymentManagementPort.getAdminStripeConfig(params);
  }

  updateLocalStripeEnabled(params: {
    brandId: string;
    localId: string;
    enabled: boolean;
  }) {
    return this.paymentManagementPort.updateLocalStripeEnabled(params);
  }

  createStripeOnboardingLink(params: {
    scope: CommerceOnlinePaymentScope;
    scopeId: string;
    baseUrl: string;
    country: string;
  }) {
    return this.paymentManagementPort.createStripeOnboardingLink(params);
  }

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
  }) {
    return this.paymentManagementPort.createStripeCheckoutSession(params);
  }

  fetchStripeSession(params: { sessionId: string }) {
    return this.paymentManagementPort.fetchStripeSession(params);
  }

  constructWebhookEvent(params: {
    rawBody: Buffer;
    signature?: string;
    webhookSecret?: string;
  }) {
    return this.paymentManagementPort.constructWebhookEvent(params);
  }
}
