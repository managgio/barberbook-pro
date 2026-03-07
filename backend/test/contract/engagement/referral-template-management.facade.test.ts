import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { RewardType } from '@prisma/client';
import { ReferralTemplatesService } from '@/modules/referrals/referral-templates.service';
import { EngagementReferralTemplateManagementPort } from '@/contexts/engagement/ports/outbound/referral-template-management.port';

const baseTemplate = {
  id: 'tpl-1',
  brandId: 'brand-1',
  name: 'Plantilla base',
  enabled: true,
  attributionExpiryDays: 30,
  newCustomerOnly: true,
  monthlyMaxRewardsPerReferrer: null,
  allowedServiceIds: null,
  rewardReferrerType: RewardType.WALLET,
  rewardReferrerValue: 5,
  rewardReferrerServiceId: null,
  rewardReferredType: RewardType.WALLET,
  rewardReferredValue: 5,
  rewardReferredServiceId: null,
  antiFraud: {
    blockSelfByUser: true,
    blockSelfByContact: true,
    blockDuplicateContact: true,
  },
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const basePort = (): EngagementReferralTemplateManagementPort => ({
  list: async () => [baseTemplate],
  listForLocal: async () => [baseTemplate],
  create: async () => baseTemplate,
  update: async () => baseTemplate,
  remove: async () => ({ success: true }),
});

test('referral templates facade delegates listForLocal', async () => {
  const calls: string[] = [];
  const service = new ReferralTemplatesService({
    ...basePort(),
    listForLocal: async (localId) => {
      calls.push(localId);
      return [baseTemplate];
    },
  });

  const result = await service.listForLocal('loc-1');

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'loc-1');
  assert.equal(result[0].id, 'tpl-1');
});

test('referral templates facade delegates create', async () => {
  const calls: string[] = [];
  const service = new ReferralTemplatesService({
    ...basePort(),
    create: async (brandId) => {
      calls.push(brandId);
      return { ...baseTemplate, brandId };
    },
  });

  const result = await service.create('brand-2', {
    name: 'New template',
    rewardReferrerType: RewardType.WALLET,
    rewardReferredType: RewardType.WALLET,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'brand-2');
  assert.equal(result.brandId, 'brand-2');
});
