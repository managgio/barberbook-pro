import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSmsRecipient } from '@/contexts/engagement/domain/services/sms-recipient.policy';

test('SMS recipient normalization accepts valid E.164-sized international numbers', () => {
  assert.equal(normalizeSmsRecipient('+34 600 111 222'), '+34600111222');
  assert.equal(normalizeSmsRecipient('0034 600 111 222'), '+34600111222');
});

test('SMS recipient normalization rejects international numbers outside 8 to 15 digits', () => {
  assert.equal(normalizeSmsRecipient('+1234567'), null);
  assert.equal(normalizeSmsRecipient('+1234567890123456'), null);
  assert.equal(normalizeSmsRecipient('001234567'), null);
});

test('SMS recipient normalization rejects an invalid zero country calling code', () => {
  assert.equal(normalizeSmsRecipient('+00000000'), null);
  assert.equal(normalizeSmsRecipient('0000000000'), null);
});
