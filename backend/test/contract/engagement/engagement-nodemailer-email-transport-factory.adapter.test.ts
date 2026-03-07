import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { NodemailerEmailTransportFactoryAdapter } from '@/contexts/engagement/infrastructure/adapters/nodemailer-email-transport-factory.adapter';

test('creates email transport and delegates sendMail payload', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const adapter = new NodemailerEmailTransportFactoryAdapter((config) => {
    calls.push({ kind: 'createTransport', config });
    return {
      sendMail: async (payload: unknown) => {
        calls.push({ kind: 'sendMail', payload: payload as Record<string, unknown> });
        return { accepted: ['client@example.com'] };
      },
    };
  });

  const transport = adapter.createTransport({
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    auth: { user: 'mailer@example.com', pass: 'secret' },
  });
  await transport.sendMail({
    from: '"Brand" <mailer@example.com>',
    to: 'client@example.com',
    subject: 'Test',
    text: 'hello',
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].kind, 'createTransport');
  assert.equal((calls[0].config as any).host, 'smtp.example.com');
  assert.equal(calls[1].kind, 'sendMail');
  assert.equal((calls[1].payload as any).to, 'client@example.com');
});
