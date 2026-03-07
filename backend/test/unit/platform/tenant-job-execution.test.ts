import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { runTenantScopedJob } from '@/shared/application/tenant-job-execution';

const buildLogger = () => {
  const logs: string[] = [];
  const warns: string[] = [];
  const errors: Array<{ message: string; trace?: string }> = [];
  return {
    logger: {
      log: (message: string) => logs.push(message),
      warn: (message: string) => warns.push(message),
      error: (message: string, trace?: string) => errors.push({ message, trace }),
    },
    logs,
    warns,
    errors,
  };
};

test('runTenantScopedJob aggregates metrics across locations', async () => {
  const { logger, logs, warns, errors } = buildLogger();
  const iterator = {
    forEachActiveLocation: async (callback: (context: { brandId: string; localId: string }) => Promise<void>) => {
      await callback({ brandId: 'brand-1', localId: 'local-1' });
      await callback({ brandId: 'brand-2', localId: 'local-2' });
    },
  };

  const summary = await runTenantScopedJob({
    jobName: 'sample-job',
    logger,
    iterator,
    executeForLocation: async ({ localId }) => ({
      processed: localId === 'local-1' ? 2 : 3,
      skipped: 1,
    }),
  });

  assert.equal(summary.locationsProcessed, 2);
  assert.equal(summary.locationsSucceeded, 2);
  assert.equal(summary.locationsFailed, 0);
  assert.equal(summary.failureRate, 0);
  assert.equal(summary.metrics.processed, 5);
  assert.equal(summary.metrics.skipped, 2);
  assert.equal(errors.length, 0);
  assert.equal(warns.length, 0);
  assert.equal(logs.length, 2);
});

test('runTenantScopedJob continues after local failure and logs structured error', async () => {
  const { logger, warns, errors } = buildLogger();
  const iterator = {
    forEachActiveLocation: async (callback: (context: { brandId: string; localId: string }) => Promise<void>) => {
      await callback({ brandId: 'brand-1', localId: 'local-1' });
      await callback({ brandId: 'brand-2', localId: 'local-2' });
    },
  };

  const summary = await runTenantScopedJob({
    jobName: 'sample-job',
    logger,
    iterator,
    executeForLocation: async ({ localId }) => {
      if (localId === 'local-2') {
        throw new Error('boom');
      }
      return { processed: 4 };
    },
  });

  assert.equal(summary.locationsProcessed, 2);
  assert.equal(summary.locationsSucceeded, 1);
  assert.equal(summary.locationsFailed, 1);
  assert.equal(summary.failureRate, 0.5);
  assert.equal(summary.metrics.processed, 4);
  assert.equal(errors.length, 1);
  assert.equal(warns.length, 0);
  assert.match(errors[0].message, /local execution failed/);
  assert.match(errors[0].message, /brandId=brand-2/);
  assert.match(errors[0].message, /localId=local-2/);
});

test('runTenantScopedJob emits warn when thresholds are exceeded', async () => {
  const { logger, warns } = buildLogger();
  const iterator = {
    forEachActiveLocation: async (callback: (context: { brandId: string; localId: string }) => Promise<void>) => {
      await callback({ brandId: 'brand-1', localId: 'local-1' });
      await callback({ brandId: 'brand-2', localId: 'local-2' });
    },
  };

  const summary = await runTenantScopedJob({
    jobName: 'sample-job',
    logger,
    iterator,
    alertPolicy: {
      failureRateWarnThreshold: 0.1,
      failedLocationsWarnThreshold: 1,
    },
    executeForLocation: async ({ localId }) => {
      if (localId === 'local-2') {
        throw new Error('boom');
      }
      return { processed: 1 };
    },
  });

  assert.equal(summary.locationsFailed, 1);
  assert.equal(summary.failureRate, 0.5);
  assert.equal(warns.length, 1);
  assert.match(warns[0], /alert threshold reached/);
});
