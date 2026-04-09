import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBrandConfigFromEnv } from '@/tenancy/tenant-config.defaults';

test('tenant brand defaults keep communications feature disabled by default', () => {
  const config = buildBrandConfigFromEnv();
  assert.equal(config.features?.communicationsEnabled, false);
});
