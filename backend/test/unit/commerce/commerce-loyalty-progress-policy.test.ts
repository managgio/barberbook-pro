import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  buildLoyaltyProgress,
  isNextLoyaltyVisitFree,
} from '@/contexts/commerce/domain/services/loyalty-progress-policy';

test('build loyalty progress normalizes required visits and computes cycle fields', () => {
  const progress = buildLoyaltyProgress({
    requiredVisits: 5,
    totalVisitsAccumulated: 7,
  });
  assert.deepEqual(progress, {
    totalVisits: 5,
    totalVisitsAccumulated: 7,
    cycleVisits: 2,
    nextFreeIn: 3,
    isRewardNext: false,
  });
});

test('next loyalty visit free policy uses active visits and required cycle', () => {
  assert.equal(
    isNextLoyaltyVisitFree({
      requiredVisits: 4,
      totalVisitsAccumulated: 3,
      activeVisits: 3,
    }),
    true,
  );
  assert.equal(
    isNextLoyaltyVisitFree({
      requiredVisits: 4,
      totalVisitsAccumulated: 3,
      activeVisits: 2,
    }),
    false,
  );
});
