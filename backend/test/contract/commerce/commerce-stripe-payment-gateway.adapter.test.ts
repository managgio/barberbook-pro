import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { StripePaymentGatewayAdapter } from '@/contexts/commerce/infrastructure/adapters/stripe-payment-gateway.adapter';

test('createCheckoutSession maps stripe session payload and response', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const fakeStripe = {
    accounts: {
      retrieve: async () => ({ charges_enabled: true, payouts_enabled: true, details_submitted: true }),
      create: async () => ({ id: 'acct_new' }),
    },
    accountLinks: {
      create: async () => ({ url: 'https://connect.test/link' }),
    },
    checkout: {
      sessions: {
        create: async (payload: Record<string, unknown>, options: Record<string, unknown>) => {
          calls.push({ payload, options });
          return {
            id: 'cs_1',
            url: 'https://checkout.test/session',
            status: 'open',
            payment_status: 'unpaid',
            payment_intent: { id: 'pi_1' },
            amount_total: 4999,
            currency: 'eur',
            metadata: { appointmentId: 'apt-1' },
            client_reference_id: 'apt-1',
          };
        },
        retrieve: async () => ({ id: 'cs_1' }),
      },
    },
    webhooks: {
      constructEvent: () => ({ type: 'checkout.session.completed', data: { object: { id: 'cs_1' } } }),
    },
  } as any;

  const adapter = new StripePaymentGatewayAdapter(() => fakeStripe);
  const session = await adapter.createCheckoutSession({
    accountId: 'acct_1',
    currency: 'eur',
    unitAmount: 4999,
    serviceName: 'Corte',
    customerEmail: 'guest@example.com',
    clientReferenceId: 'apt-1',
    metadata: { appointmentId: 'apt-1' },
    expiresAt: 1_700_000_000,
    successUrl: 'https://app.test/success',
    cancelUrl: 'https://app.test/cancel',
  });

  assert.equal(calls.length, 1);
  assert.equal((calls[0].options as any)?.stripeAccount, 'acct_1');
  assert.equal(session.id, 'cs_1');
  assert.equal(session.payment_intent, 'pi_1');
  assert.equal(session.client_reference_id, 'apt-1');
});

test('constructWebhookEvent validates signature flow and normalizes checkout payload', () => {
  const fakeStripe = {
    accounts: {
      retrieve: async () => ({ charges_enabled: true, payouts_enabled: true, details_submitted: true }),
      create: async () => ({ id: 'acct_new' }),
    },
    accountLinks: {
      create: async () => ({ url: 'https://connect.test/link' }),
    },
    checkout: {
      sessions: {
        create: async () => ({ id: 'cs_1' }),
        retrieve: async () => ({ id: 'cs_1' }),
      },
    },
    webhooks: {
      constructEvent: (raw: Buffer, signature: string, secret: string) => {
        assert.equal(raw.toString('utf-8'), 'payload');
        assert.equal(signature, 'sig-1');
        assert.equal(secret, 'whsec-1');
        return {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_1',
              status: 'complete',
              payment_status: 'paid',
              payment_intent: 'pi_1',
              amount_total: 2500,
              currency: 'eur',
              metadata: { appointmentId: 'apt-1' },
              client_reference_id: 'apt-1',
            },
          },
        };
      },
    },
  } as any;

  const adapter = new StripePaymentGatewayAdapter(() => fakeStripe);
  const event = adapter.constructWebhookEvent({
    rawBody: Buffer.from('payload'),
    signature: 'sig-1',
    webhookSecret: 'whsec-1',
  });

  assert.equal(event.type, 'checkout.session.completed');
  assert.equal((event.data.object as any).id, 'cs_1');
  assert.equal((event.data.object as any).payment_intent, 'pi_1');
});

test('constructWebhookEvent parses json payload when webhook secret is not configured', () => {
  const fakeStripe = {
    accounts: {
      retrieve: async () => ({ charges_enabled: true, payouts_enabled: true, details_submitted: true }),
      create: async () => ({ id: 'acct_new' }),
    },
    accountLinks: {
      create: async () => ({ url: 'https://connect.test/link' }),
    },
    checkout: {
      sessions: {
        create: async () => ({ id: 'cs_1' }),
        retrieve: async () => ({ id: 'cs_1' }),
      },
    },
    webhooks: {
      constructEvent: () => ({ type: 'checkout.session.completed', data: { object: {} } }),
    },
  } as any;

  const adapter = new StripePaymentGatewayAdapter(() => fakeStripe);
  const event = adapter.constructWebhookEvent({
    rawBody: Buffer.from(
      JSON.stringify({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1',
            amount_received: 1500,
            currency: 'eur',
          },
        },
      }),
      'utf-8',
    ),
  });

  assert.equal(event.type, 'payment_intent.succeeded');
  assert.equal((event.data.object as any).id, 'pi_1');
  assert.equal((event.data.object as any).amount_received, 1500);
});
