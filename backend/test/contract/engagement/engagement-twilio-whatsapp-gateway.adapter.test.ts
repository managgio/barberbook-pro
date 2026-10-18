import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { TwilioWhatsappGatewayAdapter } from '@/contexts/engagement/infrastructure/adapters/twilio-whatsapp-gateway.adapter';

const withWhatsappEnvironment = async (run: () => Promise<void>) => {
  const keys = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_ACCOUNT_TOKEN',
    'TWILIO_WHATSAPP_FROM',
    'TWILIO_WHATSAPP_TEMPLATE_SID',
    'TWILIO_WHATSAPP_COST_USD',
  ] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.TWILIO_ACCOUNT_SID = 'AC_GLOBAL';
  process.env.TWILIO_AUTH_TOKEN = 'global-token';
  process.env.TWILIO_WHATSAPP_FROM = '+34600999888';
  delete process.env.TWILIO_WHATSAPP_COST_USD;
  try {
    await run();
  } finally {
    keys.forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
  }
};

test('Twilio WhatsApp gateway maps the neutral template command at the infrastructure edge', async () => {
  await withWhatsappEnvironment(async () => {
    process.env.TWILIO_WHATSAPP_TEMPLATE_SID = 'HX_TEMPLATE';
    const calls: Array<Record<string, unknown>> = [];
    const gateway = new TwilioWhatsappGatewayAdapter((accountSid, authToken) => {
      calls.push({ kind: 'client', accountSid, authToken });
      return {
        messages: {
          create: async (payload) => {
            calls.push({ kind: 'message', payload });
            return { sid: 'SM_WHATSAPP', price: '-0.05', priceUnit: 'USD' };
          },
        },
      };
    });

    assert.equal(gateway.isReadyForRoutineDelivery(), true);

    const result = await gateway.send({
      to: '+34600111222',
      body: 'Fallback body',
      templateData: { name: 'Cliente', brand: 'Ronin', date: '18/10/2026', time: '10:00' },
    });

    assert.equal(result.status, 'accepted');
    const payload = calls[1].payload as Record<string, unknown>;
    assert.equal(payload.from, 'whatsapp:+34600999888');
    assert.equal(payload.to, 'whatsapp:+34600111222');
    assert.equal(payload.contentSid, 'HX_TEMPLATE');
    assert.equal(payload.body, undefined);
    assert.equal(payload.contentVariables, JSON.stringify({
      1: 'Cliente',
      2: 'Ronin',
      3: '18/10/2026',
      4: '10:00',
    }));
  });
});

test('Twilio WhatsApp gateway readiness fails closed when the global sender is missing', async () => {
  await withWhatsappEnvironment(async () => {
    delete process.env.TWILIO_WHATSAPP_FROM;
    const gateway = new TwilioWhatsappGatewayAdapter();
    assert.equal(gateway.isReadyForRoutineDelivery(), false);
  });
});

test('Twilio WhatsApp gateway uses text when no provider template is configured', async () => {
  await withWhatsappEnvironment(async () => {
    delete process.env.TWILIO_WHATSAPP_TEMPLATE_SID;
    const payloads: Array<Record<string, unknown>> = [];
    const gateway = new TwilioWhatsappGatewayAdapter(() => ({
      messages: {
        create: async (value) => {
          payloads.push(value);
          return { sid: 'SM_WHATSAPP', price: null, priceUnit: null };
        },
      },
    }));

    await gateway.send({
      to: '+34600111222',
      body: 'Mensaje libre',
      templateData: { name: 'Cliente', brand: 'Ronin', date: '18/10/2026', time: '10:00' },
    });

    assert.equal(payloads[0].body, 'Mensaje libre');
    assert.equal(payloads[0].contentSid, undefined);
  });
});

test('Twilio WhatsApp gateway accepts the provider sender with a whatsapp prefix', async () => {
  await withWhatsappEnvironment(async () => {
    process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+34600999888';
    delete process.env.TWILIO_WHATSAPP_TEMPLATE_SID;
    const payloads: Array<Record<string, unknown>> = [];
    const gateway = new TwilioWhatsappGatewayAdapter(() => ({
      messages: {
        create: async (value) => {
          payloads.push(value);
          return { sid: 'SM_WHATSAPP', price: null, priceUnit: null };
        },
      },
    }));

    const result = await gateway.send({
      to: '+34600111222',
      body: 'Mensaje libre',
      templateData: { name: 'Cliente', brand: 'Ronin', date: '18/10/2026', time: '10:00' },
    });

    assert.equal(result.status, 'accepted');
    assert.equal(payloads[0].from, 'whatsapp:+34600999888');
  });
});

test('Twilio WhatsApp gateway returns provider-neutral errors', async () => {
  await withWhatsappEnvironment(async () => {
    const gateway = new TwilioWhatsappGatewayAdapter(() => ({
      messages: { create: async () => { throw { code: 21610, message: 'provider detail' }; } },
    }));
    const result = await gateway.send({
      to: '+34600111222',
      body: 'Mensaje',
      templateData: { name: 'Cliente', brand: 'Ronin', date: '18/10/2026', time: '10:00' },
    });

    assert.equal(result.status, 'failed');
    if (result.status === 'failed') {
      assert.equal(result.code, 'WHATSAPP_RECIPIENT_OPTED_OUT');
      assert.equal(result.retryable, false);
      assert.doesNotMatch(result.message, /provider detail/);
    }
  });
});
