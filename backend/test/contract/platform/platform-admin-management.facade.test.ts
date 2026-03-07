import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformAdminService } from '@/modules/platform-admin/platform-admin.service';
import {
  PlatformAdminManagementPort,
  PlatformCreateBrandInput,
} from '@/contexts/platform/ports/outbound/platform-admin-management.port';

const basePort = (): PlatformAdminManagementPort => ({
  listBrands: async () => [],
  getBrand: async () => ({}),
  createBrand: async () => ({}),
  updateBrand: async () => ({}),
  deleteBrand: async () => ({ success: true }),
  listLocations: async () => [],
  createLocation: async () => ({}),
  updateLocation: async () => ({}),
  deleteLocation: async () => ({ success: true }),
  getBrandConfig: async () => ({}),
  listBrandAdmins: async () => ({}),
  assignBrandAdmin: async () => ({ success: true }),
  removeBrandAdmin: async () => ({ success: true }),
  updateBrandConfig: async () => ({}),
  getLocationConfig: async () => ({}),
  updateLocationConfig: async () => ({}),
  getUsageMetrics: async () => ({
    windowDays: 7,
    range: { start: '2026-03-01', end: '2026-03-07' },
    thresholds: {
      openaiDailyCostUsd: null,
      twilioDailyCostUsd: null,
      imagekitStorageBytes: null,
    },
    openai: { series: [] },
    twilio: { series: [] },
    imagekit: { series: [] },
  }),
  refreshUsageMetrics: async () => ({
    windowDays: 7,
    range: { start: '2026-03-01', end: '2026-03-07' },
    thresholds: {
      openaiDailyCostUsd: null,
      twilioDailyCostUsd: null,
      imagekitStorageBytes: null,
    },
    openai: { series: [] },
    twilio: { series: [] },
    imagekit: { series: [] },
  }),
  getBrandHealth: async () => ({}),
});

test('platform admin facade delegates create brand to management port', async () => {
  const calls: PlatformCreateBrandInput[] = [];
  const service = new PlatformAdminService({
    ...basePort(),
    createBrand: async (input) => {
      calls.push(input);
      return { id: 'brand-1', ...input };
    },
  });

  const result = await service.createBrand({
    name: 'Brand',
    subdomain: 'brand',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'Brand');
  assert.equal((result as { id: string }).id, 'brand-1');
});

test('platform admin facade delegates usage metrics reads', async () => {
  const calls: number[] = [];
  const service = new PlatformAdminService({
    ...basePort(),
    getUsageMetrics: async (windowDays) => {
      calls.push(windowDays);
      return basePort().getUsageMetrics(windowDays);
    },
  });

  const result = await service.getUsageMetrics(14);

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 14);
  assert.equal(result.windowDays, 7);
});

