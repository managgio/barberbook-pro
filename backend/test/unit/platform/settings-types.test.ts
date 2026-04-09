import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSettings } from '@/modules/settings/settings.types';

test('site settings keep phone-required disabled by default', () => {
  const settings = normalizeSettings();
  assert.equal(settings.profile.phoneRequired, false);
});

test('site settings allow enabling phone-required policy', () => {
  const settings = normalizeSettings({
    profile: { phoneRequired: true },
  });
  assert.equal(settings.profile.phoneRequired, true);
});
