import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { TwilioSmsGatewayAdapter } from '@/contexts/engagement/infrastructure/adapters/twilio-sms-gateway.adapter';

const withSmsEnvironment = async (run: () => Promise<void>) => {
  const keys = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_ACCOUNT_TOKEN',
    'TWILIO_MESSAGING_SERVICE_SID',
    'SMS_STATUS_CALLBACK_URL',
    'TWILIO_SMS_COST_USD',
    'NODE_ENV',
  ] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.TWILIO_ACCOUNT_SID = 'AC_GLOBAL';
  process.env.TWILIO_AUTH_TOKEN = 'global-token';
  process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG_MANAGGIO';
  process.env.SMS_STATUS_CALLBACK_URL = 'https://api.managgio.com/webhooks/sms/status?source=twilio';
  process.env.NODE_ENV = 'production';
  delete process.env.TWILIO_SMS_COST_USD;
  try {
    await run();
  } finally {
    keys.forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
  }
};

test('Twilio SMS gateway forces the global sender within its Messaging Service and uses an opaque callback reference', async () => {
  await withSmsEnvironment(async () => {
    const calls: Array<Record<string, unknown>> = [];
    const gateway = new TwilioSmsGatewayAdapter((accountSid, authToken) => {
      calls.push({ kind: 'client', accountSid, authToken });
      return {
        messages: {
          create: async (payload) => {
            calls.push({ kind: 'message', payload });
            return { sid: 'SM_123', from: 'MANAGGIO', price: '-0.0875', priceUnit: 'usd' };
          },
        },
      };
    });

    const result = await gateway.send({
      to: '+34600111222',
      body: 'Recordatorio',
      purpose: 'routine',
      deliveryReference: 'delivery-123',
    });

    assert.deepEqual(result, {
      status: 'accepted',
      providerMessageId: 'SM_123',
      sender: 'MANAGGIO',
      cost: { amount: 0.0875, currency: 'USD' },
    });
    assert.deepEqual(calls[0], { kind: 'client', accountSid: 'AC_GLOBAL', authToken: 'global-token' });
    const payload = calls[1].payload as Record<string, unknown>;
    assert.equal(payload.messagingServiceSid, 'MG_MANAGGIO');
    assert.equal(payload.from, 'MANAGGIO');
    assert.equal(
      payload.statusCallback,
      'https://api.managgio.com/webhooks/sms/status?source=twilio&deliveryId=delivery-123',
    );
  });
});

test('Twilio SMS gateway fails safely when global configuration is incomplete', async () => {
  await withSmsEnvironment(async () => {
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;
    let clientCreations = 0;
    const gateway = new TwilioSmsGatewayAdapter(() => {
      clientCreations += 1;
      throw new Error('must not create a client');
    });

    const result = await gateway.send({ to: '+34600111222', body: 'Recordatorio', purpose: 'routine' });

    assert.equal(result.status, 'failed');
    if (result.status === 'failed') {
      assert.equal(result.code, 'SMS_GATEWAY_NOT_CONFIGURED');
      assert.equal(result.critical, true);
    }
    assert.equal(clientCreations, 0);
  });
});

test('Twilio SMS gateway multiplies the fallback unit cost by actual segments', async () => {
  await withSmsEnvironment(async () => {
    process.env.TWILIO_SMS_COST_USD = '0.08';
    const gateway = new TwilioSmsGatewayAdapter(() => ({
      messages: {
        create: async () => ({ sid: 'SM_FALLBACK', price: null, priceUnit: null }),
      },
    }));

    const result = await gateway.send({
      to: '+34600111222',
      body: 'a'.repeat(161),
      purpose: 'routine',
    });

    assert.equal(result.status, 'accepted');
    if (result.status === 'accepted') {
      assert.deepEqual(result.cost, { amount: 0.16, currency: 'USD' });
    }
  });
});

test('Twilio SMS gateway refuses tracked delivery when the global callback is missing', async () => {
  await withSmsEnvironment(async () => {
    delete process.env.SMS_STATUS_CALLBACK_URL;
    let messageCalls = 0;
    const gateway = new TwilioSmsGatewayAdapter(() => ({
      messages: {
        create: async () => {
          messageCalls += 1;
          return { sid: 'SM_NEVER', price: null, priceUnit: null };
        },
      },
    }));

    const result = await gateway.send({
      to: '+34600111222',
      body: 'Recordatorio',
      purpose: 'routine',
      deliveryReference: 'delivery-123',
    });

    assert.equal(result.status, 'failed');
    if (result.status === 'failed') assert.equal(result.code, 'SMS_GATEWAY_CALLBACK_INVALID');
    assert.equal(messageCalls, 0);
  });
});

test('Twilio SMS gateway maps provider failures to provider-neutral safe errors', async () => {
  await withSmsEnvironment(async () => {
    const gateway = new TwilioSmsGatewayAdapter(() => ({
      messages: {
        create: async () => {
          throw { code: 20003, status: 401, message: 'secret provider detail' };
        },
      },
    }));

    const result = await gateway.send({ to: '+34600111222', body: 'Recordatorio', purpose: 'routine' });

    assert.equal(result.status, 'failed');
    if (result.status === 'failed') {
      assert.equal(result.code, 'SMS_GATEWAY_AUTH_FAILED');
      assert.equal(result.critical, true);
      assert.doesNotMatch(result.message, /secret provider detail/);
    }
  });
});

test('Twilio SMS gateway treats a sender outside the Messaging Service pool as a permanent critical failure', async () => {
  await withSmsEnvironment(async () => {
    const gateway = new TwilioSmsGatewayAdapter(() => ({
      messages: {
        create: async () => {
          throw { code: 21711, status: 400, message: 'provider detail must not leak' };
        },
      },
    }));

    const result = await gateway.send({ to: '+34600111222', body: 'Recordatorio', purpose: 'routine' });

    assert.deepEqual(result, {
      status: 'failed',
      code: 'SMS_SENDER_INVALID',
      message: 'The configured global SMS sender is invalid or unavailable.',
      retryable: false,
      critical: true,
    });
  });
});

test('Twilio SMS gateway reports routine readiness only with a valid HTTPS callback and global settings', async () => {
  await withSmsEnvironment(async () => {
    const gateway = new TwilioSmsGatewayAdapter();
    assert.equal(gateway.isReadyForRoutineDelivery(), true);

    process.env.SMS_STATUS_CALLBACK_URL = 'http://api.managgio.test/webhooks/sms/status';
    assert.equal(gateway.isReadyForRoutineDelivery(), false);

    process.env.SMS_STATUS_CALLBACK_URL = 'https://api.managgio.test/webhooks/sms/status';
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;
    assert.equal(gateway.isReadyForRoutineDelivery(), false);
  });
});

test('Twilio SMS gateway blocks routine delivery outside production even when called directly', async () => {
  await withSmsEnvironment(async () => {
    process.env.NODE_ENV = 'development';
    let messageCalls = 0;
    const gateway = new TwilioSmsGatewayAdapter(() => ({
      messages: {
        create: async () => {
          messageCalls += 1;
          return { sid: 'SM_NEVER', price: null, priceUnit: null };
        },
      },
    }));

    const result = await gateway.send({
      to: '+34600111222',
      body: 'Recordatorio',
      purpose: 'routine',
      deliveryReference: 'delivery-123',
    });

    assert.equal(result.status, 'failed');
    if (result.status === 'failed') assert.equal(result.code, 'SMS_ROUTINE_DELIVERY_DISABLED');
    assert.equal(messageCalls, 0);
  });
});

test('Twilio SMS gateway allows explicit Platform tests only locally', async () => {
  await withSmsEnvironment(async () => {
    let messageCalls = 0;
    const gateway = new TwilioSmsGatewayAdapter(() => ({
      messages: {
        create: async () => {
          messageCalls += 1;
          return { sid: 'SM_LOCAL', price: null, priceUnit: null };
        },
      },
    }));

    process.env.NODE_ENV = 'development';
    const localResult = await gateway.send({
      to: '+34600111222',
      body: 'Prueba local',
      purpose: 'platform_test',
    });
    assert.equal(localResult.status, 'accepted');
    assert.equal(messageCalls, 1);

    process.env.NODE_ENV = 'production';
    const productionResult = await gateway.send({
      to: '+34600111222',
      body: 'Prueba prohibida',
      purpose: 'platform_test',
    });
    assert.equal(productionResult.status, 'failed');
    if (productionResult.status === 'failed') assert.equal(productionResult.code, 'SMS_TEST_LOCAL_ONLY');
    assert.equal(messageCalls, 1);
  });
});
