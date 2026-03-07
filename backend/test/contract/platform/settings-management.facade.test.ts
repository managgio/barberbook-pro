import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { SettingsService } from '@/modules/settings/settings.service';
import { PlatformSettingsManagementPort } from '@/contexts/platform/ports/outbound/platform-settings-management.port';
import { normalizeSettings } from '@/modules/settings/settings.types';

const baseSettings = normalizeSettings();

const basePort = (): PlatformSettingsManagementPort => ({
  getSettings: async () => baseSettings,
  updateSettings: async (settings) => settings,
});

test('settings facade delegates getSettings', async () => {
  const calls: string[] = [];
  const service = new SettingsService({
    ...basePort(),
    getSettings: async () => {
      calls.push('get');
      return baseSettings;
    },
  });

  const result = await service.getSettings();

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'get');
  assert.equal(result.branding.name, baseSettings.branding.name);
});

test('settings facade delegates updateSettings', async () => {
  const calls: Array<{ productsEnabled: boolean }> = [];
  const service = new SettingsService({
    ...basePort(),
    updateSettings: async (settings) => {
      calls.push({ productsEnabled: Boolean(settings.products.enabled) });
      return settings;
    },
  });

  const payload = normalizeSettings({
    ...baseSettings,
    products: {
      ...baseSettings.products,
      enabled: true,
    },
  });
  const result = await service.updateSettings(payload);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].productsEnabled, true);
  assert.equal(result.products.enabled, true);
});
