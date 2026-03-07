import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { PrismaActiveLocationIteratorAdapter } from '@/contexts/platform/infrastructure/adapters/prisma-active-location-iterator.adapter';

test('forEachActiveLocation iterates locations in order and executes callback in tenant context', async () => {
  const contexts: Array<{ brandId: string; localId: string }> = [];
  const callbackCalls: Array<{ brandId: string; localId: string }> = [];

  const prisma = {
    location: {
      findMany: async () => [
        { id: 'local-1', brandId: 'brand-1' },
        { id: 'local-2', brandId: 'brand-2' },
      ],
    },
  } as any;

  const runner = {
    runWithContext: async (
      context: { brandId: string; localId: string },
      callback: () => Promise<void>,
    ) => {
      contexts.push(context);
      await callback();
    },
  } as any;

  const adapter = new PrismaActiveLocationIteratorAdapter(prisma, runner);
  await adapter.forEachActiveLocation(async (context) => {
    callbackCalls.push(context);
  });

  assert.deepEqual(contexts, [
    { brandId: 'brand-1', localId: 'local-1' },
    { brandId: 'brand-2', localId: 'local-2' },
  ]);
  assert.deepEqual(callbackCalls, contexts);
});

test('forEachActiveLocation propagates callback error', async () => {
  const prisma = {
    location: {
      findMany: async () => [{ id: 'local-1', brandId: 'brand-1' }],
    },
  } as any;

  const runner = {
    runWithContext: async (
      _context: { brandId: string; localId: string },
      callback: () => Promise<void>,
    ) => callback(),
  } as any;

  const adapter = new PrismaActiveLocationIteratorAdapter(prisma, runner);

  await assert.rejects(
    () =>
      adapter.forEachActiveLocation(async () => {
        throw new Error('boom');
      }),
    /boom/,
  );
});
