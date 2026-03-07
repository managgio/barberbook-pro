import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ManageOnlinePaymentsUseCase } from '@/contexts/commerce/application/use-cases/manage-online-payments.use-case';
import { CommercePaymentManagementPort } from '@/contexts/commerce/ports/outbound/payment-management.port';

test('manage online payments use case delegates checkout creation to management port', async () => {
  let payload: any = null;
  const port: CommercePaymentManagementPort = {
    getStripeAvailability: async () => ({ enabled: true }),
    getAdminStripeConfig: async () => ({
      mode: 'location',
      brandEnabled: true,
      platformEnabled: true,
      localEnabled: true,
      accountIdExists: true,
      status: null,
    }),
    updateLocalStripeEnabled: async () => ({ enabled: true }),
    createStripeOnboardingLink: async () => ({ url: 'https://example.test', accountId: 'acct_1' }),
    createStripeCheckoutSession: async (params) => {
      payload = params;
      return { mode: 'stripe', checkoutUrl: 'https://checkout.test', appointmentId: 'appt_1' };
    },
    fetchStripeSession: async () => ({
      id: 'cs_1',
      url: 'https://checkout.test',
      status: 'open',
      payment_status: 'unpaid',
      payment_intent: null,
      amount_total: 1000,
      currency: 'eur',
      metadata: {},
      client_reference_id: null,
    }),
    constructWebhookEvent: () => ({ type: 'unknown', data: { object: {} } }),
  };

  const useCase = new ManageOnlinePaymentsUseCase(port);
  const result = await useCase.createStripeCheckoutSession({
    brandId: 'brand-1',
    localId: 'local-1',
    baseUrl: 'https://app.test',
    defaultCurrency: 'eur',
    paymentTtlMinutes: 30,
    data: {
      barberId: 'barber-1',
      serviceId: 'service-1',
      startDateTime: '2026-03-06T10:00:00.000Z',
    },
  });

  assert.equal(payload?.brandId, 'brand-1');
  assert.equal(payload?.localId, 'local-1');
  assert.deepEqual(result, {
    mode: 'stripe',
    checkoutUrl: 'https://checkout.test',
    appointmentId: 'appt_1',
  });
});
