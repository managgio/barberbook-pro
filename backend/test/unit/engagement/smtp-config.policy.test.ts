import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildSmtpTransportConfig,
  normalizeSmtpConfig,
  requireCompleteSmtpConfig,
} from '@/contexts/engagement/domain/services/smtp-config.policy';

test('normalizes a copied Gmail app password and builds a STARTTLS transport', () => {
  const normalized = requireCompleteSmtpConfig({
    user: '  Sender@Gmail.com ',
    password: 'abcd efgh ijkl mnop',
    host: ' SMTP.GMAIL.COM ',
    port: '587',
  });

  assert.deepEqual(normalized, {
    user: 'sender@gmail.com',
    password: 'abcdefghijklmnop',
    host: 'smtp.gmail.com',
    port: 587,
  });
  const transport = buildSmtpTransportConfig(normalized);
  assert.equal(transport.secure, false);
  assert.equal(transport.requireTLS, true);
  assert.equal(transport.tls.minVersion, 'TLSv1.2');
});

test('preserves meaningful whitespace inside passwords for non-Google SMTP providers', () => {
  const normalized = normalizeSmtpConfig({
    user: 'sender@example.com',
    password: '  secret phrase  ',
    host: 'smtp.example.com',
    port: 465,
  });

  assert.equal(normalized?.password, 'secret phrase');
  assert.equal(normalized?.port, 465);
});

test('infers the supported provider host and default submission port', () => {
  assert.deepEqual(
    normalizeSmtpConfig({ user: 'sender@hotmail.com', password: 'secret' }),
    {
      user: 'sender@hotmail.com',
      password: 'secret',
      host: 'smtp.office365.com',
      port: 587,
    },
  );
});

test('rejects incomplete SMTP credentials before opening a connection', () => {
  assert.throws(
    () => requireCompleteSmtpConfig({ user: 'sender@gmail.com' }),
    /SMTP_CONFIG_INCOMPLETE/,
  );
});
