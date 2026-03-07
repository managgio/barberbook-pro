import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { RewardType } from '@prisma/client';
import { ReferralConfigService } from '@/modules/referrals/referral-config.service';
import { EngagementReferralConfigManagementPort } from '@/contexts/engagement/ports/outbound/referral-config-management.port';

const basePort = (): EngagementReferralConfigManagementPort => ({
  isModuleEnabled: async () => true,
  getConfig: async () => ({
    id: null,
    localId: 'loc-1',
    enabled: false,
    attributionExpiryDays: 30,
    newCustomerOnly: true,
    monthlyMaxRewardsPerReferrer: null,
    allowedServiceIds: null,
    rewardReferrerType: RewardType.WALLET,
    rewardReferrerValue: 5,
    rewardReferrerServiceId: null,
    rewardReferrerServiceName: null,
    rewardReferredType: RewardType.WALLET,
    rewardReferredValue: 5,
    rewardReferredServiceId: null,
    rewardReferredServiceName: null,
    antiFraud: {
      blockSelfByUser: true,
      blockSelfByContact: true,
      blockDuplicateContact: true,
    },
    appliedTemplateId: null,
  }),
  getConfigOrThrow: async () => ({
    id: null,
    localId: 'loc-1',
    enabled: false,
    attributionExpiryDays: 30,
    newCustomerOnly: true,
    monthlyMaxRewardsPerReferrer: null,
    allowedServiceIds: null,
    rewardReferrerType: RewardType.WALLET,
    rewardReferrerValue: 5,
    rewardReferrerServiceId: null,
    rewardReferrerServiceName: null,
    rewardReferredType: RewardType.WALLET,
    rewardReferredValue: 5,
    rewardReferredServiceId: null,
    rewardReferredServiceName: null,
    antiFraud: {
      blockSelfByUser: true,
      blockSelfByContact: true,
      blockDuplicateContact: true,
    },
    appliedTemplateId: null,
  }),
  updateConfig: async () => ({
    id: 'cfg-1',
    localId: 'loc-1',
    enabled: true,
    attributionExpiryDays: 30,
    newCustomerOnly: true,
    monthlyMaxRewardsPerReferrer: null,
    allowedServiceIds: null,
    rewardReferrerType: RewardType.WALLET,
    rewardReferrerValue: 5,
    rewardReferrerServiceId: null,
    rewardReferrerServiceName: null,
    rewardReferredType: RewardType.WALLET,
    rewardReferredValue: 5,
    rewardReferredServiceId: null,
    rewardReferredServiceName: null,
    antiFraud: {
      blockSelfByUser: true,
      blockSelfByContact: true,
      blockDuplicateContact: true,
    },
    appliedTemplateId: null,
  }),
  applyTemplate: async () => ({
    id: 'cfg-1',
    localId: 'loc-1',
    enabled: true,
    attributionExpiryDays: 30,
    newCustomerOnly: true,
    monthlyMaxRewardsPerReferrer: null,
    allowedServiceIds: null,
    rewardReferrerType: RewardType.WALLET,
    rewardReferrerValue: 5,
    rewardReferrerServiceId: null,
    rewardReferrerServiceName: null,
    rewardReferredType: RewardType.WALLET,
    rewardReferredValue: 5,
    rewardReferredServiceId: null,
    rewardReferredServiceName: null,
    antiFraud: {
      blockSelfByUser: true,
      blockSelfByContact: true,
      blockDuplicateContact: true,
    },
    appliedTemplateId: 'tpl-1',
  }),
  copyFromLocation: async () => ({
    id: 'cfg-1',
    localId: 'loc-1',
    enabled: true,
    attributionExpiryDays: 30,
    newCustomerOnly: true,
    monthlyMaxRewardsPerReferrer: null,
    allowedServiceIds: null,
    rewardReferrerType: RewardType.WALLET,
    rewardReferrerValue: 5,
    rewardReferrerServiceId: null,
    rewardReferrerServiceName: null,
    rewardReferredType: RewardType.WALLET,
    rewardReferredValue: 5,
    rewardReferredServiceId: null,
    rewardReferredServiceName: null,
    antiFraud: {
      blockSelfByUser: true,
      blockSelfByContact: true,
      blockDuplicateContact: true,
    },
    appliedTemplateId: null,
  }),
});

test('referral config facade delegates getConfig', async () => {
  const calls: string[] = [];
  const service = new ReferralConfigService({
    ...basePort(),
    getConfig: async () => {
      calls.push('getConfig');
      return basePort().getConfig();
    },
  });

  const result = await service.getConfig();

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'getConfig');
  assert.equal(result.localId, 'loc-1');
});

test('referral config facade delegates updateConfig', async () => {
  const calls: boolean[] = [];
  const service = new ReferralConfigService({
    ...basePort(),
    updateConfig: async (input) => {
      calls.push(Boolean(input.enabled));
      return {
        ...(await basePort().getConfig()),
        id: 'cfg-2',
        enabled: Boolean(input.enabled),
      };
    },
  });

  const result = await service.updateConfig({ enabled: true });

  assert.equal(calls.length, 1);
  assert.equal(calls[0], true);
  assert.equal(result.id, 'cfg-2');
});
