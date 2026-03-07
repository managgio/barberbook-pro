import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { PrismaAiToolsReadAdapter } from '@/contexts/ai-orchestration/infrastructure/prisma/prisma-ai-tools-read.adapter';

test('findActiveBarbers delegates expected prisma query', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const adapter = new PrismaAiToolsReadAdapter({
    barber: {
      findMany: async (query: Record<string, unknown>) => {
        calls.push(query);
        return [{ id: 'barber-1', name: 'Alex' }];
      },
    },
  } as any);

  const result = await adapter.findActiveBarbers({ localId: 'local-1' });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'barber-1');
  assert.equal((calls[0].where as any).localId, 'local-1');
  assert.equal((calls[0].where as any).isActive, true);
});

test('findClientsByNameTerms short-circuits when terms are empty', async () => {
  const adapter = new PrismaAiToolsReadAdapter({
    user: {
      findMany: async () => {
        throw new Error('should not be called');
      },
    },
  } as any);

  const result = await adapter.findClientsByNameTerms({
    brandId: 'brand-1',
    terms: ['   ', ''],
  });

  assert.deepEqual(result, []);
});
