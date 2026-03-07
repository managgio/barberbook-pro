import { BadRequestException, Injectable, InternalServerErrorException, Optional } from '@nestjs/common';
import Stripe from 'stripe';
import {
  CommerceStripeAccountStatus,
  CommerceStripeCheckoutSession,
  CommerceStripePaymentGatewayPort,
  CommerceStripePaymentIntent,
  CommerceStripeWebhookEvent,
} from '../../ports/outbound/stripe-payment-gateway.port';

type StripeClientFactory = () => Stripe;

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const toStringOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const toNumberOrNull = (value: unknown): number | null => (typeof value === 'number' ? value : null);

const toMetadata = (value: unknown): Record<string, string> => {
  const input = toRecord(value);
  const metadata: Record<string, string> = {};
  Object.entries(input).forEach(([key, metadataValue]) => {
    if (metadataValue === undefined || metadataValue === null) return;
    metadata[key] = String(metadataValue);
  });
  return metadata;
};

const normalizeCheckoutSession = (value: unknown): CommerceStripeCheckoutSession => {
  const input = toRecord(value);
  const paymentIntentRaw = input.payment_intent;
  const paymentIntent =
    typeof paymentIntentRaw === 'string'
      ? paymentIntentRaw
      : toStringOrNull(toRecord(paymentIntentRaw).id);
  return {
    id: toStringOrNull(input.id) ?? '',
    url: toStringOrNull(input.url),
    status: toStringOrNull(input.status),
    payment_status: toStringOrNull(input.payment_status),
    payment_intent: paymentIntent,
    amount_total: toNumberOrNull(input.amount_total),
    currency: toStringOrNull(input.currency),
    metadata: toMetadata(input.metadata),
    client_reference_id: toStringOrNull(input.client_reference_id),
  };
};

const normalizePaymentIntent = (value: unknown): CommerceStripePaymentIntent => {
  const input = toRecord(value);
  return {
    id: toStringOrNull(input.id) ?? '',
    amount_received: toNumberOrNull(input.amount_received),
    currency: toStringOrNull(input.currency),
  };
};

@Injectable()
export class StripePaymentGatewayAdapter implements CommerceStripePaymentGatewayPort {
  private stripeClient: Stripe | null = null;

  constructor(
    @Optional()
    private readonly stripeClientFactory?: StripeClientFactory,
  ) {}

  private buildDefaultClientFactory(): StripeClientFactory {
    return () => {
      const secret = process.env.STRIPE_SECRET_KEY;
      if (!secret) {
        throw new InternalServerErrorException('Stripe no está configurado.');
      }
      return new Stripe(secret, { apiVersion: '2023-10-16' });
    };
  }

  private getClient() {
    if (this.stripeClient) return this.stripeClient;
    const factory = this.stripeClientFactory ?? this.buildDefaultClientFactory();
    this.stripeClient = factory();
    return this.stripeClient;
  }

  async getAccountStatus(params: { accountId: string }): Promise<CommerceStripeAccountStatus> {
    const account = await this.getClient().accounts.retrieve(params.accountId);
    return {
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
    };
  }

  async createExpressAccount(params: {
    country: string;
    businessName: string;
    productDescription: string;
  }): Promise<{ id: string }> {
    const account = await this.getClient().accounts.create({
      type: 'express',
      country: params.country,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: params.businessName,
        product_description: params.productDescription,
      },
    });
    return { id: account.id };
  }

  async createAccountLink(params: {
    accountId: string;
    refreshUrl: string;
    returnUrl: string;
  }): Promise<{ url: string }> {
    const link = await this.getClient().accountLinks.create({
      account: params.accountId,
      refresh_url: params.refreshUrl,
      return_url: params.returnUrl,
      type: 'account_onboarding',
    });
    return { url: link.url };
  }

  async createCheckoutSession(params: {
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
  }): Promise<CommerceStripeCheckoutSession> {
    const session = await this.getClient().checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: params.currency,
              unit_amount: params.unitAmount,
              product_data: {
                name: params.serviceName,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: params.customerEmail || undefined,
        client_reference_id: params.clientReferenceId,
        metadata: params.metadata,
        expires_at: params.expiresAt,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
      },
      { stripeAccount: params.accountId },
    );
    return normalizeCheckoutSession(session);
  }

  async retrieveCheckoutSession(params: {
    sessionId: string;
    accountId?: string;
  }): Promise<CommerceStripeCheckoutSession> {
    const session = params.accountId
      ? await this.getClient().checkout.sessions.retrieve(
        params.sessionId,
        { stripeAccount: params.accountId },
      )
      : await this.getClient().checkout.sessions.retrieve(params.sessionId);
    return normalizeCheckoutSession(session);
  }

  constructWebhookEvent(params: {
    rawBody: Buffer;
    signature?: string;
    webhookSecret?: string;
  }): CommerceStripeWebhookEvent {
    const rawEvent = this.resolveRawEvent(params);
    return this.normalizeWebhookEvent(rawEvent);
  }

  private resolveRawEvent(params: {
    rawBody: Buffer;
    signature?: string;
    webhookSecret?: string;
  }): Stripe.Event | Record<string, unknown> {
    if (params.webhookSecret) {
      if (!params.signature) throw new BadRequestException('Firma de Stripe ausente.');
      try {
        return this.getClient().webhooks.constructEvent(
          params.rawBody,
          params.signature,
          params.webhookSecret,
        );
      } catch (error: any) {
        console.error('Stripe webhook signature error:', error?.message || error);
        throw new BadRequestException('Firma de Stripe invalida.');
      }
    }
    return JSON.parse(params.rawBody.toString('utf-8')) as Record<string, unknown>;
  }

  private normalizeWebhookEvent(rawEvent: Stripe.Event | Record<string, unknown>): CommerceStripeWebhookEvent {
    const raw = toRecord(rawEvent);
    const type = toStringOrNull(raw.type) ?? 'unknown';
    const object = toRecord(toRecord(raw.data).object);

    if (type === 'checkout.session.completed' || type === 'checkout.session.expired') {
      return { type, data: { object: normalizeCheckoutSession(object) } };
    }
    if (type === 'payment_intent.succeeded' || type === 'payment_intent.payment_failed') {
      return { type, data: { object: normalizePaymentIntent(object) } };
    }
    return { type, data: { object } };
  }
}
