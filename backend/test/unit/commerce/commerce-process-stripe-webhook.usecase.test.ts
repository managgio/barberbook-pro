import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ProcessStripeWebhookUseCase } from '@/contexts/commerce/application/use-cases/process-stripe-webhook.use-case';
import {
  CommerceAppointmentPaymentLifecycleState,
  CommercePaymentLifecyclePort,
} from '@/contexts/commerce/ports/outbound/payment-lifecycle.port';
import {
  CommerceStripeCheckoutSession,
  CommerceStripePaymentIntent,
} from '@/contexts/commerce/ports/outbound/stripe-payment-gateway.port';

class FakePaymentLifecyclePort implements CommercePaymentLifecyclePort {
  appointments = new Map<string, CommerceAppointmentPaymentLifecycleState>();
  intents = new Map<string, string>();
  expiredByLocal = new Map<string, string[]>();
  paidAppointments: string[] = [];
  cancelledAppointments: string[] = [];
  paidSubscriptionsById: string[] = [];
  cancelledSubscriptionsById: string[] = [];
  failedSubscriptionsByIntent: string[] = [];
  paidSubscriptionsByIntent: string[] = [];

  async findAppointmentById(appointmentId: string) {
    return this.appointments.get(appointmentId) || null;
  }

  async findAppointmentByPaymentIntent(paymentIntentId: string) {
    const appointmentId = this.intents.get(paymentIntentId);
    if (!appointmentId) return null;
    return this.findAppointmentById(appointmentId);
  }

  async findExpiredPendingAppointmentIds(params: { localId: string; now: Date }) {
    void params.now;
    return this.expiredByLocal.get(params.localId) || [];
  }

  async markAppointmentPaid(params: {
    appointmentId: string;
    localId: string;
    brandId: string;
    amountTotal: number | null;
    currency: string;
    paidAt: Date;
  }) {
    void params.localId;
    void params.brandId;
    void params.amountTotal;
    void params.currency;
    void params.paidAt;
    this.paidAppointments.push(params.appointmentId);
  }

  async cancelAppointmentPaymentAndBooking(params: {
    appointmentId: string;
    localId: string;
    brandId: string;
    reason: string;
    cancelledAt: Date;
  }) {
    void params.localId;
    void params.brandId;
    void params.reason;
    void params.cancelledAt;
    this.cancelledAppointments.push(params.appointmentId);
  }

  async markSubscriptionPaidById(params: {
    subscriptionId: string;
    amountTotal: number | null;
    currency: string;
    paidAt: Date;
  }) {
    void params.amountTotal;
    void params.currency;
    void params.paidAt;
    this.paidSubscriptionsById.push(params.subscriptionId);
  }

  async cancelPendingSubscriptionById(params: { subscriptionId: string; cancelledAt: Date }) {
    void params.cancelledAt;
    this.cancelledSubscriptionsById.push(params.subscriptionId);
  }

  async failPendingSubscriptionByPaymentIntent(params: {
    paymentIntentId: string;
    failedAt: Date;
  }) {
    void params.failedAt;
    this.failedSubscriptionsByIntent.push(params.paymentIntentId);
  }

  async markSubscriptionPaidByPaymentIntent(params: {
    paymentIntentId: string;
    amountTotal: number | null;
    currency: string;
    paidAt: Date;
  }) {
    void params.amountTotal;
    void params.currency;
    void params.paidAt;
    this.paidSubscriptionsByIntent.push(params.paymentIntentId);
  }
}

const checkoutSession = (
  metadata: Record<string, string>,
  overrides?: Partial<CommerceStripeCheckoutSession>,
): CommerceStripeCheckoutSession => ({
  id: 'cs_1',
  url: null,
  status: null,
  payment_status: null,
  payment_intent: null,
  amount_total: 5000,
  currency: 'eur',
  metadata,
  client_reference_id: null,
  ...overrides,
});

const paymentIntent = (id: string, overrides?: Partial<CommerceStripePaymentIntent>): CommerceStripePaymentIntent => ({
  id,
  amount_received: 3000,
  currency: 'eur',
  ...overrides,
});

test('checkout.completed marca cita pagada cuando la cita sigue activa', async () => {
  const port = new FakePaymentLifecyclePort();
  port.appointments.set('appt-1', {
    id: 'appt-1',
    localId: 'loc-1',
    brandId: 'brand-1',
    status: 'confirmed',
    paymentStatus: 'pending',
  });
  const useCase = new ProcessStripeWebhookUseCase(port, 'eur');

  await useCase.handleCheckoutCompleted(checkoutSession({ appointmentId: 'appt-1' }));

  assert.deepEqual(port.paidAppointments, ['appt-1']);
  assert.deepEqual(port.paidSubscriptionsById, []);
});

test('checkout.completed no reprocesa cita ya pagada', async () => {
  const port = new FakePaymentLifecyclePort();
  port.appointments.set('appt-paid', {
    id: 'appt-paid',
    localId: 'loc-1',
    brandId: 'brand-1',
    status: 'confirmed',
    paymentStatus: 'paid',
  });
  const useCase = new ProcessStripeWebhookUseCase(port, 'eur');

  await useCase.handleCheckoutCompleted(checkoutSession({ appointmentId: 'appt-paid' }));

  assert.deepEqual(port.paidAppointments, []);
  assert.deepEqual(port.paidSubscriptionsById, []);
});

test('checkout.expired no cancela cita ya pagada o completada', async () => {
  const port = new FakePaymentLifecyclePort();
  port.appointments.set('appt-paid', {
    id: 'appt-paid',
    localId: 'loc-1',
    brandId: 'brand-1',
    status: 'confirmed',
    paymentStatus: 'paid',
  });
  port.appointments.set('appt-done', {
    id: 'appt-done',
    localId: 'loc-1',
    brandId: 'brand-1',
    status: 'completed',
    paymentStatus: 'pending',
  });
  const useCase = new ProcessStripeWebhookUseCase(port, 'eur');

  await useCase.handleCheckoutExpired(checkoutSession({ appointmentId: 'appt-paid' }));
  await useCase.handleCheckoutExpired(checkoutSession({ appointmentId: 'appt-done' }));

  assert.deepEqual(port.cancelledAppointments, []);
});

test('payment.failed cancela cita pendiente asociada al payment intent', async () => {
  const port = new FakePaymentLifecyclePort();
  port.appointments.set('appt-2', {
    id: 'appt-2',
    localId: 'loc-1',
    brandId: 'brand-1',
    status: 'confirmed',
    paymentStatus: 'pending',
  });
  port.intents.set('pi_1', 'appt-2');
  const useCase = new ProcessStripeWebhookUseCase(port, 'eur');

  await useCase.handlePaymentFailed(paymentIntent('pi_1'));

  assert.deepEqual(port.cancelledAppointments, ['appt-2']);
  assert.deepEqual(port.failedSubscriptionsByIntent, []);
});

test('payment.succeeded deriva a subscription cuando no encuentra cita', async () => {
  const port = new FakePaymentLifecyclePort();
  const useCase = new ProcessStripeWebhookUseCase(port, 'eur');

  await useCase.handlePaymentSucceeded(paymentIntent('pi_sub'));

  assert.deepEqual(port.paidAppointments, []);
  assert.deepEqual(port.paidSubscriptionsByIntent, ['pi_sub']);
});

test('payment.succeeded no deriva a subscription cuando el payment intent pertenece a cita ya pagada', async () => {
  const port = new FakePaymentLifecyclePort();
  port.appointments.set('appt-paid', {
    id: 'appt-paid',
    localId: 'loc-1',
    brandId: 'brand-1',
    status: 'confirmed',
    paymentStatus: 'paid',
  });
  port.intents.set('pi_paid', 'appt-paid');
  const useCase = new ProcessStripeWebhookUseCase(port, 'eur');

  await useCase.handlePaymentSucceeded(paymentIntent('pi_paid'));

  assert.deepEqual(port.paidAppointments, []);
  assert.deepEqual(port.paidSubscriptionsByIntent, []);
});

test('cancelExpiredStripePayments contabiliza solo cancelaciones efectivas', async () => {
  const port = new FakePaymentLifecyclePort();
  port.expiredByLocal.set('loc-1', ['appt-ok', 'appt-cancelled']);
  port.appointments.set('appt-ok', {
    id: 'appt-ok',
    localId: 'loc-1',
    brandId: 'brand-1',
    status: 'confirmed',
    paymentStatus: 'pending',
  });
  port.appointments.set('appt-cancelled', {
    id: 'appt-cancelled',
    localId: 'loc-1',
    brandId: 'brand-1',
    status: 'cancelled',
    paymentStatus: 'pending',
  });
  const useCase = new ProcessStripeWebhookUseCase(port, 'eur');

  const result = await useCase.cancelExpiredStripePayments({
    localId: 'loc-1',
    now: new Date('2026-03-05T12:00:00.000Z'),
  });

  assert.deepEqual(port.cancelledAppointments, ['appt-ok']);
  assert.deepEqual(result, { cancelled: 1 });
});
