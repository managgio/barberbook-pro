import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PaymentsPublicController } from '@/modules/payments/payments.public.controller';

const checkoutPayload = {
  barberId: 'barber-1',
  serviceId: 'service-1',
  startDateTime: '2026-10-20T09:00:00.000Z',
};

const buildController = (user: { id: string } | null) => {
  let forwarded: any = null;
  const paymentsService = {
    createStripeCheckoutSession: async (data: any, baseUrl: string, requestMeta: any) => {
      forwarded = { data, baseUrl, requestMeta };
      return { mode: 'stripe', checkoutUrl: 'https://checkout.test', appointmentId: 'appt-1' };
    },
  };
  const authService = {
    resolveUserFromRequest: async () => user,
  };
  const controller = new PaymentsPublicController(paymentsService as any, authService as any);
  const request = {
    protocol: 'https',
    get: (name: string) => (name === 'host' ? 'tenant.example.test' : undefined),
    headers: { 'user-agent': 'test-agent' },
    ip: '127.0.0.1',
  } as any;
  return { controller, request, getForwarded: () => forwarded };
};

test('Stripe checkout binds an authenticated booking to the token user', async () => {
  const { controller, request, getForwarded } = buildController({ id: 'client-1' });

  await controller.createCheckout(
    {
      ...checkoutPayload,
      guestName: 'Injected guest',
      guestEmail: 'guest@example.test',
      guestPhone: '+34600000000',
      reminderChannels: ['sms'],
    },
    request,
  );

  assert.equal(getForwarded().data.userId, 'client-1');
  assert.equal(getForwarded().data.guestName, undefined);
  assert.equal(getForwarded().data.guestEmail, undefined);
  assert.equal(getForwarded().data.guestPhone, undefined);
  assert.equal(getForwarded().data.reminderChannels, undefined);
});

test('Stripe checkout rejects an authenticated booking for another user', async () => {
  const { controller, request } = buildController({ id: 'client-1' });

  await assert.rejects(
    () => controller.createCheckout({ ...checkoutPayload, userId: 'client-2' }, request),
    ForbiddenException,
  );
});

test('Stripe checkout rejects a guest supplied userId', async () => {
  const { controller, request } = buildController(null);

  await assert.rejects(
    () => controller.createCheckout({ ...checkoutPayload, userId: 'client-1' }, request),
    BadRequestException,
  );
});
