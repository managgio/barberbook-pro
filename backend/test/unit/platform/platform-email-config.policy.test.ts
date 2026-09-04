import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hasPlatformEmailConnectionChanged,
  preparePlatformConfigUpdate,
  redactPlatformEmailSecret,
  resolvePlatformEmailVerificationConfig,
} from '@/modules/platform-admin/platform-email-config.policy';

const stored = {
  branding: { name: 'Ronin' },
  email: {
    user: 'sender@gmail.com',
    password: 'abcd efgh ijkl mnop',
    host: 'smtp.gmail.com',
    port: 587,
    fromName: 'Ronin',
  },
};

test('platform config responses disclose only whether an SMTP password exists', () => {
  const result = redactPlatformEmailSecret(stored);

  assert.equal((result.email as any).password, undefined);
  assert.equal((result.email as any).passwordConfigured, true);
  assert.doesNotMatch(JSON.stringify(result), /abcd|mnop/);
});

test('an unrelated platform save preserves and normalizes the stored Gmail app password', () => {
  const prepared = preparePlatformConfigUpdate(stored, {
    branding: { name: 'Ronin actualizado' },
    email: {
      user: 'sender@gmail.com',
      passwordConfigured: true,
      host: 'smtp.gmail.com',
      port: 587,
      fromName: 'Ronin',
    },
  });

  assert.equal((prepared.email as any).password, 'abcdefghijklmnop');
  assert.equal((prepared.email as any).passwordConfigured, undefined);
  assert.equal(hasPlatformEmailConnectionChanged(stored, prepared), false);
});

test('a newly entered SMTP password replaces the stored secret and requires verification', () => {
  const prepared = preparePlatformConfigUpdate(stored, {
    email: {
      user: 'sender@gmail.com',
      password: 'qrst uvwx yzab cdef',
      host: 'smtp.gmail.com',
      port: 587,
    },
  });

  assert.equal((prepared.email as any).password, 'qrstuvwxyzabcdef');
  assert.equal(hasPlatformEmailConnectionChanged(stored, prepared), true);
});

test('manual verification reuses the stored secret when the password field is empty', () => {
  const result = resolvePlatformEmailVerificationConfig(stored, {
    user: 'sender@gmail.com',
    password: '',
    host: 'smtp.gmail.com',
    port: 587,
  });

  assert.equal(result?.password, 'abcdefghijklmnop');
});

test('an explicitly empty email section removes the stored SMTP configuration', () => {
  const result = preparePlatformConfigUpdate({
    email: {
      user: 'sender@gmail.com',
      password: 'stored-password',
      host: 'smtp.gmail.com',
      port: 587,
    },
  }, { email: {} });

  assert.equal(result.email, undefined);
});
