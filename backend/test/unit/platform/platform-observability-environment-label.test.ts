import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveObservabilityEnvironmentLabel } from '@/modules/observability/adapters/in-memory-prisma-platform-observability.adapter';

test('resolveObservabilityEnvironmentLabel: defaults to local when env is empty', () => {
  const label = resolveObservabilityEnvironmentLabel({});
  assert.equal(label, 'local');
});

test('resolveObservabilityEnvironmentLabel: maps production variants to prod', () => {
  assert.equal(resolveObservabilityEnvironmentLabel({ NODE_ENV: 'production' }), 'prod');
  assert.equal(resolveObservabilityEnvironmentLabel({ APP_ENV: 'prod-eu' }), 'prod');
});

test('resolveObservabilityEnvironmentLabel: maps staging variants to staging', () => {
  assert.equal(resolveObservabilityEnvironmentLabel({ APP_ENV: 'staging' }), 'staging');
  assert.equal(resolveObservabilityEnvironmentLabel({ OBSERVABILITY_RUNTIME_ENV: 'preprod' }), 'staging');
  assert.equal(resolveObservabilityEnvironmentLabel({ VERCEL_ENV: 'preview' }), 'staging');
});

test('resolveObservabilityEnvironmentLabel: maps local/dev/test to local', () => {
  assert.equal(resolveObservabilityEnvironmentLabel({ NODE_ENV: 'development' }), 'local');
  assert.equal(resolveObservabilityEnvironmentLabel({ APP_ENV: 'local' }), 'local');
  assert.equal(resolveObservabilityEnvironmentLabel({ NODE_ENV: 'test' }), 'local');
});

test('resolveObservabilityEnvironmentLabel: keeps unknown labels normalized', () => {
  const label = resolveObservabilityEnvironmentLabel({ OBSERVABILITY_RUNTIME_ENV: 'Sandbox-US' });
  assert.equal(label, 'sandbox-us');
});
