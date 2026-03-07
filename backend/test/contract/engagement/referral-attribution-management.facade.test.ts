import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReferralAttributionService } from '@/modules/referrals/referral-attribution.service';
import { EngagementReferralAttributionManagementPort } from '@/contexts/engagement/ports/outbound/referral-attribution-management.port';

const basePort = (): EngagementReferralAttributionManagementPort => ({
  getRewardSummaryPayload: async () => ({}),
  getReferrerSummary: async () => ({}),
  resolveReferral: async () => ({}),
  attributeReferral: async () => ({ attributionId: 'attr-1', expiresAt: new Date().toISOString() }),
  resolveAttributionForBooking: async () => null,
  attachAttributionToAppointment: async () => null,
  handleAppointmentCancelled: async () => undefined,
  handleAppointmentCompleted: async () => undefined,
  listReferrals: async () => ({ total: 0, items: [] }),
  getOverview: async () => ({ invites: 0, pending: 0, confirmed: 0, revenueAttributable: 0, topAmbassadors: [] }),
  voidAttribution: async () => ({ success: true }),
});

test('referral attribution facade delegates public attribute call', async () => {
  const calls: string[] = [];
  const service = new ReferralAttributionService({
    ...basePort(),
    attributeReferral: async (payload) => {
      calls.push(payload.code);
      return { attributionId: 'attr-2', expiresAt: '2026-03-05T00:00:00.000Z' };
    },
  });

  const result = await service.attributeReferral({
    code: 'ABC123',
    channel: 'link' as any,
    userId: 'user-1',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'ABC123');
  assert.equal((result as { attributionId: string }).attributionId, 'attr-2');
});

test('referral attribution facade delegates admin list call', async () => {
  const calls: number[] = [];
  const service = new ReferralAttributionService({
    ...basePort(),
    listReferrals: async (params) => {
      calls.push(params.page);
      return { total: 1, items: [] };
    },
  });

  const result = await service.listReferrals({ page: 2, pageSize: 20 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 2);
  assert.equal((result as { total: number }).total, 1);
});
