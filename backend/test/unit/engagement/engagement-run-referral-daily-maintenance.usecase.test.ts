import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { RunReferralDailyMaintenanceUseCase } from '@/contexts/engagement/application/use-cases/run-referral-daily-maintenance.use-case';
import { EngagementReferralMaintenancePort } from '@/contexts/engagement/ports/outbound/referral-maintenance.port';

test('run referral daily maintenance aggregates metrics from port', async () => {
  const calls: string[] = [];
  const port: EngagementReferralMaintenancePort = {
    expireAttributions: async () => {
      calls.push('expire');
      return 3;
    },
    cleanupStaleHolds: async () => {
      calls.push('cleanup');
      return 2;
    },
  };
  const useCase = new RunReferralDailyMaintenanceUseCase(port);

  const result = await useCase.execute();

  assert.equal(calls.length, 2);
  assert.ok(calls.includes('expire'));
  assert.ok(calls.includes('cleanup'));
  assert.equal(result.referralAttributionsExpired, 3);
  assert.equal(result.referralStaleHoldsProcessed, 2);
});
