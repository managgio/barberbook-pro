import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { LegalService } from '@/modules/legal/legal.service';
import { PlatformLegalManagementPort } from '@/contexts/platform/ports/outbound/platform-legal-management.port';

const baseSettings = {
  brandId: 'brand-1',
  ownerName: 'Brand 1',
  taxId: null,
  address: null,
  contactEmail: 'legal@brand.test',
  contactPhone: null,
  country: 'ES',
  privacyPolicyVersion: 1,
  cookiePolicyVersion: 1,
  legalNoticeVersion: 1,
  aiDisclosureEnabled: true,
  aiProviderNames: ['OpenAI'],
  subProcessors: [],
  optionalCustomSections: {},
  retentionDays: null,
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const basePort = (): PlatformLegalManagementPort => ({
  getSettings: async () => baseSettings,
  updateSettings: async () => baseSettings,
  getPolicyContent: async () => ({
    title: 'Politica de privacidad',
    effectiveDate: '2026-01-01',
    version: 1,
    sections: [],
    businessIdentity: { ownerName: 'Brand 1' },
    aiDisclosure: null,
  }),
  recordPrivacyConsent: async () => ({ id: 'consent-1' }),
  hasUserPrivacyConsent: async () => false,
  getDpaContent: async () => ({
    title: 'DPA',
    effectiveDate: '2026-01-01',
    version: 1,
    sections: [],
    businessIdentity: { ownerName: 'Brand 1' },
    aiDisclosure: null,
  }),
});

test('legal facade delegates getSettings', async () => {
  const calls: Array<{ brandId?: string; localId?: string | null }> = [];
  const service = new LegalService({
    ...basePort(),
    getSettings: async (brandId, localId) => {
      calls.push({ brandId, localId });
      return baseSettings;
    },
  });

  const result = await service.getSettings('brand-2', 'loc-2');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].brandId, 'brand-2');
  assert.equal(calls[0].localId, 'loc-2');
  assert.equal(result.brandId, 'brand-1');
});

test('legal facade delegates hasUserPrivacyConsent', async () => {
  const calls: string[] = [];
  const service = new LegalService({
    ...basePort(),
    hasUserPrivacyConsent: async (userId) => {
      calls.push(userId);
      return true;
    },
  });

  const result = await service.hasUserPrivacyConsent('user-1', 2, 'brand-1');

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'user-1');
  assert.equal(result, true);
});
