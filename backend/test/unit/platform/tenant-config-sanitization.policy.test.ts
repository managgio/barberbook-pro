import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { stripProviderOwnedMessagingConfig } from '@/contexts/platform/domain/services/tenant-config-sanitization.policy';

test('tenant config never persists or exposes provider-owned messaging credentials', () => {
  const input = {
    notificationPrefs: { sms: true },
    twilio: {
      accountSid: 'AC_SECRET',
      authToken: 'secret',
      messagingServiceSid: 'MG_GLOBAL',
      smsSenderId: 'TENANT',
    },
    branding: { name: 'Ronin' },
  };

  assert.deepEqual(stripProviderOwnedMessagingConfig(input), {
    notificationPrefs: { sms: true },
    branding: { name: 'Ronin' },
  });
  assert.equal(Object.prototype.hasOwnProperty.call(input, 'twilio'), true);
});
