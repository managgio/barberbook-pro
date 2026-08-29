import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotificationDeliveryWorkerService } from '@/modules/notifications/notification-delivery-worker.service';

test('email delivery worker selects a bounded due batch and restores tenant context per row', async () => {
  const contexts: any[] = [];
  const dispatched: string[] = [];
  let query: any = null;
  const worker = new NotificationDeliveryWorkerService(
    { runWithLock: async (_key: string, callback: any) => callback() } as any,
    {
      runWithContext: async (context: any, callback: any) => {
        contexts.push(context);
        return callback();
      },
    } as any,
    {
      notificationDelivery: {
        findMany: async (params: any) => {
          query = params;
          return [
            { id: 'delivery-1', brandId: 'brand-1', localId: 'local-1' },
            { id: 'delivery-2', brandId: 'brand-2', localId: 'local-2' },
          ];
        },
      },
    } as any,
    {
      dispatchDelivery: async (deliveryId: string) => {
        dispatched.push(deliveryId);
      },
    } as any,
  );

  await (worker as any).processDueBatch();

  assert.equal(query.take, 100);
  assert.deepEqual(query.where.local, { isActive: true, brand: { isActive: true } });
  assert.deepEqual(contexts, [
    { brandId: 'brand-1', localId: 'local-1' },
    { brandId: 'brand-2', localId: 'local-2' },
  ]);
  assert.deepEqual(dispatched, ['delivery-1', 'delivery-2']);
});
