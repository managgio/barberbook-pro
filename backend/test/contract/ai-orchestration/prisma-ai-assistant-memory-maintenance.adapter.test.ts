import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { PrismaAiAssistantMemoryMaintenanceAdapter } from '@/contexts/ai-orchestration/infrastructure/prisma/prisma-ai-assistant-memory-maintenance.adapter';

test('AI retention cleanup removes expired sessions and messages across every tenant', async () => {
  const calls: Array<{ model: string; where: unknown }> = [];
  const adapter = new PrismaAiAssistantMemoryMaintenanceAdapter({
    aiChatSession: {
      deleteMany: async ({ where }: { where: unknown }) => {
        calls.push({ model: 'session', where });
        return { count: 3 };
      },
    },
    aiChatMessage: {
      deleteMany: async ({ where }: { where: unknown }) => {
        calls.push({ model: 'message', where });
        return { count: 14 };
      },
    },
  } as any);
  const cutoff = new Date('2026-07-19T12:00:00.000Z');

  const result = await adapter.cleanupBeforeDate(cutoff);

  assert.deepEqual(result, {
    aiMessagesDeleted: 14,
    aiSessionsDeleted: 3,
    aiSessionsResummarized: 0,
  });
  assert.equal(calls[0].model, 'session');
  assert.equal(calls[1].model, 'message');
  assert.deepEqual(calls[1].where, { createdAt: { lt: cutoff } });
  assert.equal(JSON.stringify(calls).includes('localId'), false);
});
