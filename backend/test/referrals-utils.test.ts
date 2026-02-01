import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRewardText, normalizeAntiFraud } from '../src/modules/referrals/referral.utils';
import { RewardType } from '@prisma/client';

test('formatRewardText builds wallet text', () => {
  const text = formatRewardText({ type: RewardType.WALLET, value: 5 });
  assert.equal(text, '5.00€ de saldo');
});

test('formatRewardText builds percent text', () => {
  const text = formatRewardText({ type: RewardType.PERCENT_DISCOUNT, value: 15 });
  assert.equal(text, '15% de descuento');
});

test('formatRewardText builds fixed text', () => {
  const text = formatRewardText({ type: RewardType.FIXED_DISCOUNT, value: 7.5 });
  assert.equal(text, '7.50€ de descuento');
});

test('formatRewardText builds free service text', () => {
  const text = formatRewardText({ type: RewardType.FREE_SERVICE, serviceName: 'Corte' });
  assert.equal(text, 'Corte gratis');
});

test('normalizeAntiFraud fills defaults', () => {
  const result = normalizeAntiFraud({ blockSelfByUser: false });
  assert.deepEqual(result, {
    blockSelfByUser: false,
    blockSelfByContact: true,
    blockDuplicateContact: true,
  });
});
