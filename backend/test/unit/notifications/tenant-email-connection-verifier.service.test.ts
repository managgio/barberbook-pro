import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { TenantEmailConnectionVerifier } from '@/modules/notifications/tenant-email-connection-verifier.service';

test('verifies normalized Gmail credentials without exposing the app password', async () => {
  let receivedConfig: any = null;
  const verifier = new TenantEmailConnectionVerifier({
    createTransport: (config: any) => {
      receivedConfig = config;
      return { verify: async () => true, sendMail: async () => undefined };
    },
  });

  const result = await verifier.verify({
    user: 'sender@gmail.com',
    password: 'abcd efgh ijkl mnop',
    host: 'smtp.gmail.com',
    port: 587,
  });

  assert.equal(result.ok, true);
  assert.equal(receivedConfig.auth.pass, 'abcdefghijklmnop');
  assert.equal(receivedConfig.requireTLS, true);
  assert.equal(result.endpoint?.user, 's***@gmail.com');
  assert.doesNotMatch(JSON.stringify(result), /abcdefghijklmnop|abcd efgh/);
});

test('returns a safe authentication diagnostic when the provider rejects the credentials', async () => {
  const verifier = new TenantEmailConnectionVerifier({
    createTransport: () => ({
      verify: async () => {
        throw {
          code: 'EAUTH',
          responseCode: 535,
          message: '535 Username and Password not accepted secret-value',
        };
      },
      sendMail: async () => undefined,
    }),
  });

  const result = await verifier.verify({
    user: 'sender@gmail.com',
    password: 'secret-value',
    host: 'smtp.gmail.com',
    port: 587,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'SMTP_AUTH_FAILED');
  assert.doesNotMatch(JSON.stringify(result), /secret-value|Username and Password not accepted/);
});

test('does not open a connection for an incomplete configuration', async () => {
  let created = false;
  const verifier = new TenantEmailConnectionVerifier({
    createTransport: () => {
      created = true;
      return { verify: async () => true, sendMail: async () => undefined };
    },
  });

  const result = await verifier.verify({ user: 'sender@gmail.com' });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'SMTP_CONFIG_INCOMPLETE');
  assert.equal(created, false);
});
