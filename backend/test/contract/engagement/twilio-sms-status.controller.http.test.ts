import * as assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { Test } from '@nestjs/testing';
import * as twilio from 'twilio';
import { TwilioSmsStatusWebhookAdapter } from '@/contexts/engagement/infrastructure/adapters/twilio-sms-status-webhook.adapter';
import { buildTwilioSmsStatusCallbackUrl } from '@/contexts/engagement/infrastructure/adapters/twilio-sms-status-callback';
import { TwilioSmsStatusController } from '@/modules/notifications/twilio-sms-status.controller';
import { TenantMiddleware } from '@/tenancy/tenant.middleware';

test('SMS status callback accepts Twilio form posts with an exact signature and rejects invalid signatures', async () => {
  const previous = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    accountToken: process.env.TWILIO_ACCOUNT_TOKEN,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    callbackUrl: process.env.SMS_STATUS_CALLBACK_URL,
  };
  const accountSid = 'AC11111111111111111111111111111111';
  const authToken = 'test-auth-token';
  const deliveryReference = 'attempt_ref_123456';
  const body = {
    AccountSid: accountSid,
    MessageSid: 'SM11111111111111111111111111111111',
    MessageStatus: 'delivered',
  };
  const recorded: any[] = [];
  let receivedBody: Record<string, unknown> | null = null;
  let receivedSignature = '';
  let tenantResolutionCalls = 0;
  const webhook = new TwilioSmsStatusWebhookAdapter({
    record: async (command: any) => {
      recorded.push(command);
      return { recorded: true, deliveryId: 'delivery-1' };
    },
  } as any);
  const handle = webhook.handle.bind(webhook);
  webhook.handle = async (params) => {
    receivedBody = params.body;
    receivedSignature = params.signature;
    return handle(params);
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [TwilioSmsStatusController],
    providers: [
      { provide: TwilioSmsStatusWebhookAdapter, useValue: webhook },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  const tenantMiddleware = new TenantMiddleware({
    resolveTenant: async () => {
      tenantResolutionCalls += 1;
      throw new Error('provider callback must bypass tenant resolution');
    },
  } as any);
  app.use((request: any, response: any, next: () => void) =>
    tenantMiddleware.use(request, response, next));
  app.setGlobalPrefix('api');

  try {
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    const callbackBaseUrl = `http://127.0.0.1:${address.port}/api/notifications/webhooks/twilio/sms-status?source=twilio`;
    const callbackUrl = buildTwilioSmsStatusCallbackUrl(callbackBaseUrl, deliveryReference);
    process.env.TWILIO_ACCOUNT_SID = accountSid;
    process.env.TWILIO_ACCOUNT_TOKEN = authToken;
    process.env.TWILIO_AUTH_TOKEN = authToken;
    process.env.SMS_STATUS_CALLBACK_URL = callbackBaseUrl;

    const signature = twilio.getExpectedTwilioSignature(authToken, callbackUrl, body);
    const accepted = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': signature,
      },
      body: new URLSearchParams(body),
    });

    assert.deepEqual(receivedBody, body);
    assert.equal(receivedSignature, signature);
    assert.equal(twilio.validateRequest(authToken, signature, callbackUrl, body), true);
    assert.equal(accepted.status, 204);
    assert.equal(await accepted.text(), '');
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].deliveryReference, deliveryReference);
    assert.equal(recorded[0].providerMessageId, body.MessageSid);
    assert.equal(recorded[0].status, 'delivered');
    assert.equal(tenantResolutionCalls, 0);

    const rejected = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': 'invalid-signature',
      },
      body: new URLSearchParams(body),
    });

    assert.equal(rejected.status, 403);
    assert.equal(recorded.length, 1);
    assert.equal(tenantResolutionCalls, 0);
  } finally {
    await app.close();
    if (previous.accountSid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
    else process.env.TWILIO_ACCOUNT_SID = previous.accountSid;
    if (previous.accountToken === undefined) delete process.env.TWILIO_ACCOUNT_TOKEN;
    else process.env.TWILIO_ACCOUNT_TOKEN = previous.accountToken;
    if (previous.authToken === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = previous.authToken;
    if (previous.callbackUrl === undefined) delete process.env.SMS_STATUS_CALLBACK_URL;
    else process.env.SMS_STATUS_CALLBACK_URL = previous.callbackUrl;
  }
});
