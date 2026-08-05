import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CriticalTraceLevel,
  CriticalTraceOutcome,
} from '@/contexts/platform/domain/entities/platform-observability.entity';
import { InMemoryPrismaPlatformObservabilityAdapter } from '@/modules/observability/adapters/in-memory-prisma-platform-observability.adapter';

test('critical trace adapter persists trace with server-resolved tenant and user snapshots', async () => {
  const creates: Array<Record<string, unknown>> = [];
  const prisma = {
    criticalTraceEvent: {
      create: async (args: { data: Record<string, unknown> }) => {
        creates.push(args.data);
        return args.data;
      },
    },
  };
  const adapter = new InMemoryPrismaPlatformObservabilityAdapter(prisma as never, {} as never);

  await adapter.recordCriticalTrace(
    {
      traceId: 'trace-1',
      category: 'booking',
      stage: 'frontend_render',
      level: CriticalTraceLevel.ERROR,
      outcome: CriticalTraceOutcome.FAILED,
      path: '/app/book',
      serviceId: 'service-1',
      errorName: 'TypeError',
      message: 'Cannot read properties of undefined',
      metadata: { step: 2 },
    },
    {
      brandId: 'brand-1',
      localId: 'local-1',
      subdomain: 'ronin',
      user: { id: 'user-1', name: 'Cliente', email: 'cliente@example.com' },
      userAgent: 'Browser test',
    },
  );

  assert.equal(creates.length, 1);
  assert.equal(creates[0].brandId, 'brand-1');
  assert.equal(creates[0].category, 'booking');
  assert.equal(creates[0].localId, 'local-1');
  assert.equal(creates[0].userId, 'user-1');
  assert.equal(creates[0].userEmail, 'cliente@example.com');
  assert.equal(creates[0].outcome, 'failed');
});

test('critical trace adapter upserts the persisted PDF preference', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const prisma = {
    observabilityPreference: {
      upsert: async (args: Record<string, unknown>) => {
        calls.push(args);
        return { includeInPdf: false };
      },
    },
  };
  const adapter = new InMemoryPrismaPlatformObservabilityAdapter(prisma as never, {} as never);

  const result = await adapter.setCriticalTracePdfInclusion(false);

  assert.equal(result.includeInPdf, false);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].where, { key: 'critical-traces' });
});
