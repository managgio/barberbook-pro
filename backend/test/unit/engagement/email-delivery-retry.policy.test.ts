import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { decideNotificationDeliveryRetry } from '@/contexts/engagement/domain/services/notification-delivery-retry.policy';

test('email delivery retry policy schedules transient failures with bounded backoff', () => {
  const now = new Date('2026-08-29T10:00:00.000Z');
  const decision = decideNotificationDeliveryRetry({
    now,
    attemptCount: 1,
    maxAttempts: 5,
    retryable: true,
    critical: false,
  });

  assert.equal(decision.status, 'retrying');
  assert.equal(decision.nextAttemptAt?.toISOString(), '2026-08-29T10:00:30.000Z');
  assert.equal(decision.promoteToCriticalTrace, false);
});

test('email delivery retry policy promotes exhausted transient failures', () => {
  const decision = decideNotificationDeliveryRetry({
    now: new Date('2026-08-29T10:00:00.000Z'),
    attemptCount: 5,
    maxAttempts: 5,
    retryable: true,
    critical: false,
  });

  assert.equal(decision.status, 'failed');
  assert.equal(decision.nextAttemptAt, null);
  assert.equal(decision.promoteToCriticalTrace, true);
});

test('email delivery retry policy fails rejected recipients without critical promotion', () => {
  const decision = decideNotificationDeliveryRetry({
    now: new Date('2026-08-29T10:00:00.000Z'),
    attemptCount: 1,
    maxAttempts: 5,
    retryable: false,
    critical: false,
  });

  assert.equal(decision.status, 'failed');
  assert.equal(decision.promoteToCriticalTrace, false);
});
