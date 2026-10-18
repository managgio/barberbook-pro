import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canSendPlatformTestSms,
  canSendRoutineSms,
  isLocalSmsTestRequestAddress,
  isLocalSmsTestRequestHost,
  isValidSmsStatusCallbackUrl,
  resolveSmsRuntimeEnvironment,
} from '@/contexts/engagement/domain/services/sms-delivery-runtime.policy';

test('routine SMS is fail-closed outside production', () => {
  assert.equal(canSendRoutineSms(undefined), false);
  assert.equal(canSendRoutineSms('development'), false);
  assert.equal(canSendRoutineSms('test'), false);
  assert.equal(canSendRoutineSms('staging'), false);
  assert.equal(canSendRoutineSms('production'), true);
});

test('SMS delivery callback configuration accepts only absolute HTTP URLs', () => {
  assert.equal(isValidSmsStatusCallbackUrl('https://api.managgio.com/webhooks/sms/status'), true);
  assert.equal(isValidSmsStatusCallbackUrl('http://localhost:3000/webhooks/sms/status'), true);
  assert.equal(isValidSmsStatusCallbackUrl('http://localhost:3000/webhooks/sms/status', { requireHttps: true }), false);
  assert.equal(isValidSmsStatusCallbackUrl('https://api.managgio.com/webhooks/sms/status', { requireHttps: true }), true);
  assert.equal(isValidSmsStatusCallbackUrl('/webhooks/sms/status'), false);
  assert.equal(isValidSmsStatusCallbackUrl('javascript:alert(1)'), false);
  assert.equal(isValidSmsStatusCallbackUrl(undefined), false);
});

test('manual platform SMS tests are local-only', () => {
  assert.equal(resolveSmsRuntimeEnvironment(undefined), 'local');
  assert.equal(canSendPlatformTestSms(undefined), true);
  assert.equal(canSendPlatformTestSms('local'), true);
  assert.equal(canSendPlatformTestSms('test'), false);
  assert.equal(canSendPlatformTestSms('production'), false);
});

test('manual platform SMS endpoint only accepts a local request host', () => {
  assert.equal(isLocalSmsTestRequestHost('localhost:3000'), true);
  assert.equal(isLocalSmsTestRequestHost('tenant.localhost:3000'), true);
  assert.equal(isLocalSmsTestRequestHost('127.0.0.1:3000'), true);
  assert.equal(isLocalSmsTestRequestHost('[::1]:3000'), true);
  assert.equal(isLocalSmsTestRequestHost('platform.managgio.com'), false);
  assert.equal(isLocalSmsTestRequestHost(undefined), false);
});

test('manual platform SMS endpoint only accepts a loopback network peer', () => {
  assert.equal(isLocalSmsTestRequestAddress('127.0.0.1'), true);
  assert.equal(isLocalSmsTestRequestAddress('127.25.3.8'), true);
  assert.equal(isLocalSmsTestRequestAddress('::ffff:127.0.0.1'), true);
  assert.equal(isLocalSmsTestRequestAddress('::1'), true);
  assert.equal(isLocalSmsTestRequestAddress('192.168.1.20'), false);
  assert.equal(isLocalSmsTestRequestAddress('203.0.113.10'), false);
  assert.equal(isLocalSmsTestRequestAddress(undefined), false);
});
