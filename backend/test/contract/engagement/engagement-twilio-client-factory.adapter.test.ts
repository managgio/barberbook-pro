import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { TwilioClientFactoryAdapter } from '@/contexts/engagement/infrastructure/adapters/twilio-client-factory.adapter';

test('creates twilio client with tenant credentials and delegates message creation', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const adapter = new TwilioClientFactoryAdapter((accountSid, authToken) => {
    calls.push({ kind: 'createClient', accountSid, authToken });
    return {
      messages: {
        create: async (payload) => {
          calls.push({ kind: 'createMessage', payload });
          return { sid: 'SM123', price: '-0.045', priceUnit: 'USD' };
        },
      },
    };
  });

  const client = adapter.createClient('AC123', 'token123');
  const result = await client.messages.create({
    to: '+34611111111',
    body: 'Reminder',
    messagingServiceSid: 'MG123',
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].kind, 'createClient');
  assert.equal(calls[1].kind, 'createMessage');
  assert.equal((calls[1].payload as any).to, '+34611111111');
  assert.equal(result.sid, 'SM123');
});
