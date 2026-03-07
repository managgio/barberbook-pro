import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { TenantService } from '@/tenancy/tenant.service';

const makePrisma = () => {
  let shouldFailOnce = false;
  let shouldFailAlways = false;
  const state = {
    disconnectCalls: 0,
    connectCalls: 0,
    brandFindFirstCalls: 0,
  };

  const prisma = {
    $disconnect: async () => {
      state.disconnectCalls += 1;
    },
    $connect: async () => {
      state.connectCalls += 1;
    },
    brand: {
      findFirst: async (_args: any) => {
        state.brandFindFirstCalls += 1;
        if (shouldFailAlways) {
          const error = new Error('Server has closed the connection.');
          (error as any).code = 'P1017';
          throw error;
        }
        if (shouldFailOnce) {
          shouldFailOnce = false;
          const error = new Error('Server has closed the connection.');
          (error as any).code = 'P1017';
          throw error;
        }
        return { id: 'brand-1', defaultLocationId: 'local-1' };
      },
      findUnique: async () => null,
    },
    location: {
      findFirst: async () => ({ id: 'local-1' }),
    },
    __state: state,
    __setFailOnce: () => {
      shouldFailOnce = true;
    },
    __setFailAlways: () => {
      shouldFailAlways = true;
    },
  };

  return prisma as any;
};

test('tenant service retries once after recoverable prisma disconnect', async () => {
  const prisma = makePrisma();
  prisma.__setFailOnce();
  const service = new TenantService(prisma);

  const result = await service.resolveTenant({ host: 'leblond.managgio.com' });

  assert.equal(result.brandId, 'brand-1');
  assert.equal(result.localId, 'local-1');
  assert.equal(prisma.__state.disconnectCalls, 1);
  assert.equal(prisma.__state.connectCalls, 1);
  assert.equal(prisma.__state.brandFindFirstCalls, 2);
});

test('tenant service does not retry on non recoverable prisma error', async () => {
  const prisma = makePrisma();
  prisma.brand.findFirst = async () => {
    throw new Error('Unexpected tenant query error');
  };
  const service = new TenantService(prisma);

  await assert.rejects(
    async () => {
      await service.resolveTenant({ host: 'leblond.managgio.com' });
    },
    /Unexpected tenant query error/,
  );

  assert.equal(prisma.__state.disconnectCalls, 0);
  assert.equal(prisma.__state.connectCalls, 0);
});

test('tenant service returns 503 when recoverable prisma disconnect persists after retry', async () => {
  const prisma = makePrisma();
  prisma.__setFailAlways();
  const service = new TenantService(prisma);

  await assert.rejects(
    async () => {
      await service.resolveTenant({ host: 'leblond.managgio.com' });
    },
    (error: any) => {
      assert.equal(error?.code, 'TENANT_DB_UNAVAILABLE');
      assert.equal(error?.status, 503);
      return true;
    },
  );

  assert.equal(prisma.__state.disconnectCalls, 1);
  assert.equal(prisma.__state.connectCalls, 1);
  assert.equal(prisma.__state.brandFindFirstCalls, 2);
});
