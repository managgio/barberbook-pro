import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import * as twilio from 'twilio';
import {
  mapTwilioSmsReceiptStatus,
  TwilioSmsStatusWebhookAdapter,
} from '@/contexts/engagement/infrastructure/adapters/twilio-sms-status-webhook.adapter';
import { buildTwilioSmsStatusCallbackUrl } from '@/contexts/engagement/infrastructure/adapters/twilio-sms-status-callback';

test('Twilio SMS status mapping exposes only provider-neutral delivery states', () => {
  assert.equal(mapTwilioSmsReceiptStatus('sent'), 'sent');
  assert.equal(mapTwilioSmsReceiptStatus('delivered'), 'delivered');
  assert.equal(mapTwilioSmsReceiptStatus('undelivered'), 'undelivered');
  assert.equal(mapTwilioSmsReceiptStatus('failed'), 'failed');
  assert.equal(mapTwilioSmsReceiptStatus('canceled'), 'failed');
  assert.equal(mapTwilioSmsReceiptStatus('queued'), null);
});

test('Twilio callback URL preserves configured query parameters and adds the delivery reference', () => {
  assert.equal(
    buildTwilioSmsStatusCallbackUrl(
      'https://api.managgio.com/api/notifications/webhooks/twilio/sms-status?source=twilio',
      'delivery-1',
    ),
    'https://api.managgio.com/api/notifications/webhooks/twilio/sms-status?source=twilio&deliveryId=delivery-1',
  );
});

test('Twilio SMS status webhook accepts an exact valid signature and records a neutral receipt', async () => {
  const previous = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    callbackUrl: process.env.SMS_STATUS_CALLBACK_URL,
  };
  const accountSid = 'AC11111111111111111111111111111111';
  const authToken = 'test-auth-token';
  const callbackBaseUrl = 'https://api.managgio.com/api/notifications/webhooks/twilio/sms-status';
  const deliveryReference = 'delivery-1';
  const callbackUrl = buildTwilioSmsStatusCallbackUrl(callbackBaseUrl, deliveryReference);
  const body = {
    AccountSid: accountSid,
    MessageSid: 'SM11111111111111111111111111111111',
    MessageStatus: 'delivered',
  };
  let recorded: any = null;

  process.env.TWILIO_ACCOUNT_SID = accountSid;
  process.env.TWILIO_AUTH_TOKEN = authToken;
  process.env.SMS_STATUS_CALLBACK_URL = callbackBaseUrl;
  const adapter = new TwilioSmsStatusWebhookAdapter({
    record: async (command: any) => {
      recorded = command;
      return { recorded: true, deliveryId: deliveryReference };
    },
  } as any);

  try {
    const signature = twilio.getExpectedTwilioSignature(authToken, callbackUrl, body);
    const result = await adapter.handle({
      deliveryReference,
      signature,
      body,
      occurredAt: new Date('2026-10-17T10:00:05.000Z'),
    });

    assert.equal(result.outcome, 'recorded');
    assert.equal(recorded.deliveryReference, deliveryReference);
    assert.equal(recorded.providerMessageId, body.MessageSid);
    assert.equal(recorded.status, 'delivered');
  } finally {
    if (previous.accountSid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
    else process.env.TWILIO_ACCOUNT_SID = previous.accountSid;
    if (previous.authToken === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = previous.authToken;
    if (previous.callbackUrl === undefined) delete process.env.SMS_STATUS_CALLBACK_URL;
    else process.env.SMS_STATUS_CALLBACK_URL = previous.callbackUrl;
  }
});

test('Twilio SMS status webhook rejects an invalid signature without touching delivery state', async () => {
  const previous = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    callbackUrl: process.env.SMS_STATUS_CALLBACK_URL,
  };
  process.env.TWILIO_ACCOUNT_SID = 'AC11111111111111111111111111111111';
  process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
  process.env.SMS_STATUS_CALLBACK_URL = 'https://api.managgio.com/api/notifications/webhooks/twilio/sms-status';
  let calls = 0;
  const adapter = new TwilioSmsStatusWebhookAdapter({
    record: async () => {
      calls += 1;
      return { recorded: true, deliveryId: 'delivery-1' };
    },
  } as any);

  try {
    const result = await adapter.handle({
      deliveryReference: 'delivery-1',
      signature: 'invalid-signature',
      body: {
        AccountSid: process.env.TWILIO_ACCOUNT_SID,
        MessageSid: 'SM11111111111111111111111111111111',
        MessageStatus: 'delivered',
      },
    });

    assert.deepEqual(result, { outcome: 'invalid_signature' });
    assert.equal(calls, 0);
  } finally {
    if (previous.accountSid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
    else process.env.TWILIO_ACCOUNT_SID = previous.accountSid;
    if (previous.authToken === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = previous.authToken;
    if (previous.callbackUrl === undefined) delete process.env.SMS_STATUS_CALLBACK_URL;
    else process.env.SMS_STATUS_CALLBACK_URL = previous.callbackUrl;
  }
});
