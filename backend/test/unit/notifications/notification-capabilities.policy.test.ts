import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveNotificationCapabilities } from '@/contexts/engagement/domain/services/notification-capabilities.policy';

test('public SMS capability requires production, tenant consent and a configured global gateway', () => {
  const base = {
    notificationPrefs: { sms: true, whatsapp: true },
    smsGatewayConfigured: true,
    whatsappGatewayConfigured: true,
  };

  assert.deepEqual(resolveNotificationCapabilities({ ...base, runtimeEnvironment: 'production' }), {
    sms: true,
    whatsapp: true,
  });
  assert.equal(resolveNotificationCapabilities({ ...base, runtimeEnvironment: 'development' }).sms, false);
  assert.equal(resolveNotificationCapabilities({ ...base, runtimeEnvironment: 'production', smsGatewayConfigured: false }).sms, false);
  assert.equal(resolveNotificationCapabilities({
    ...base,
    runtimeEnvironment: 'production',
    notificationPrefs: { sms: false, whatsapp: true },
  }).sms, false);
  assert.equal(resolveNotificationCapabilities({
    ...base,
    runtimeEnvironment: 'production',
    notificationPrefs: { whatsapp: true },
  }).sms, false);
});

test('WhatsApp capability follows its tenant preference and provider configuration independently', () => {
  assert.deepEqual(resolveNotificationCapabilities({
    runtimeEnvironment: 'development',
    notificationPrefs: { sms: true, whatsapp: true },
    smsGatewayConfigured: true,
    whatsappGatewayConfigured: true,
  }), { sms: false, whatsapp: true });

  assert.equal(resolveNotificationCapabilities({
    runtimeEnvironment: 'production',
    notificationPrefs: { whatsapp: false },
    smsGatewayConfigured: true,
    whatsappGatewayConfigured: true,
  }).whatsapp, false);
});
