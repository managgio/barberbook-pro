import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { PrismaAiAdminAccessReadAdapter } from '@/contexts/ai-orchestration/infrastructure/prisma/prisma-ai-admin-access-read.adapter';

test('findUserById delegates user lookup for admin access validation', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const adapter = new PrismaAiAdminAccessReadAdapter({
    user: {
      findUnique: async (query: Record<string, unknown>) => {
        calls.push(query);
        return { id: 'admin-1', isSuperAdmin: false, isPlatformAdmin: true };
      },
    },
  } as any);

  const user = await adapter.findUserById({ userId: 'admin-1' });

  assert.equal(user?.id, 'admin-1');
  assert.equal((calls[0].where as any).id, 'admin-1');
});

test('hasLocationStaffMembership returns boolean from composite staff lookup', async () => {
  const adapter = new PrismaAiAdminAccessReadAdapter({
    locationStaff: {
      findUnique: async () => ({ userId: 'admin-1' }),
    },
  } as any);

  const hasMembership = await adapter.hasLocationStaffMembership({
    localId: 'local-1',
    userId: 'admin-1',
  });

  assert.equal(hasMembership, true);
});
