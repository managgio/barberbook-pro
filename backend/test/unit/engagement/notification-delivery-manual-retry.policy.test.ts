import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { canManuallyRetryNotificationDelivery } from '@/contexts/engagement/domain/services/notification-delivery-manual-retry.policy';

test('manual SMS retry rejects consent, recipient, length and permanent gateway failures', () => {
  const permanentCodes = [
    'SMS_RECIPIENT_OPTED_OUT',
    'SMS_RECIPIENT_INVALID',
    'PHONE_RECIPIENT_INVALID',
    'SMS_MESSAGE_TOO_LONG',
    'SMS_GATEWAY_AUTH_FAILED',
    'SMS_SENDER_INVALID',
    'SMS_GATEWAY_NOT_CONFIGURED',
    'SMS_GATEWAY_CALLBACK_INVALID',
    'SMS_DELIVERY_UNDELIVERED_21610',
    'SMS_DELIVERY_UNDELIVERED_21211',
    'SMS_DELIVERY_FAILED_21711',
  ];

  permanentCodes.forEach((lastErrorCode) => {
    assert.equal(
      canManuallyRetryNotificationDelivery({ channel: 'sms', status: 'failed', lastErrorCode }),
      false,
      lastErrorCode,
    );
  });
});

test('manual SMS retry rejects an opt-out reported by a failed provider callback', () => {
  assert.equal(canManuallyRetryNotificationDelivery({
    channel: 'sms',
    status: 'failed',
    lastErrorCode: 'SMS_DELIVERY_FAILED_21610',
  }), false);
});

test('manual SMS retry remains available for transient and carrier-undelivered incidents', () => {
  const transientCandidates = [
    { status: 'failed', lastErrorCode: 'SMS_RATE_LIMITED' },
    { status: 'failed', lastErrorCode: 'SMS_GATEWAY_TEMPORARY_FAILURE' },
    { status: 'undelivered', lastErrorCode: 'SMS_DELIVERY_UNDELIVERED_30003' },
  ];

  transientCandidates.forEach(({ status, lastErrorCode }) => {
    assert.equal(
      canManuallyRetryNotificationDelivery({ channel: 'sms', status, lastErrorCode }),
      true,
      lastErrorCode,
    );
  });
});

test('manual retry only applies to terminal incident states', () => {
  assert.equal(
    canManuallyRetryNotificationDelivery({
      channel: 'sms',
      status: 'processing',
      lastErrorCode: 'SMS_GATEWAY_TEMPORARY_FAILURE',
    }),
    false,
  );
  assert.equal(
    canManuallyRetryNotificationDelivery({
      channel: 'email',
      status: 'skipped',
      lastErrorCode: 'EMAIL_RECIPIENT_MISSING',
    }),
    false,
  );
});
