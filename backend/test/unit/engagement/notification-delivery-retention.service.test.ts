import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotificationDeliveryRetentionService } from '@/modules/notifications/notification-delivery-retention.service';

test('notification retention redacts old terminal rows and deletes expired receipts in bounded batches', async () => {
  const operations: Array<{ type: string; params: any }> = [];
  let findManyCall = 0;
  const prisma: any = {
    notificationDelivery: {
      findMany: async (params: any) => {
        findManyCall += 1;
        operations.push({ type: `findMany:${findManyCall}`, params });
        return findManyCall === 1 ? [{ id: 'resolved-1' }] : [{ id: 'receipt-1' }];
      },
      updateMany: async (params: any) => {
        operations.push({ type: 'updateMany', params });
        return { count: 1 };
      },
      deleteMany: async (params: any) => {
        operations.push({ type: 'deleteMany', params });
        return { count: 1 };
      },
    },
    notificationDeliveryAttempt: {
      deleteMany: async (params: any) => {
        operations.push({ type: 'deleteAttempts', params });
        return { count: 2 };
      },
    },
    $transaction: async (promises: Promise<unknown>[]) => Promise.all(promises),
  };
  const service = new NotificationDeliveryRetentionService(
    { runWithLock: async (_key: string, callback: () => Promise<void>) => { await callback(); return true; } } as any,
    prisma,
  );

  await service.handleCleanup(new Date('2026-08-29T03:25:00.000Z'));

  const update = operations.find((operation) => operation.type === 'updateMany');
  assert.deepEqual(update?.params.where.id.in, ['resolved-1']);
  assert.equal(update?.params.data.recipientAddress, null);
  assert.equal(update?.params.data.recipientName, null);
  assert.equal(update?.params.data.redactedAt.toISOString(), '2026-08-29T03:25:00.000Z');
  assert.deepEqual(
    operations.find((operation) => operation.type === 'deleteAttempts')?.params.where.deliveryId.in,
    ['resolved-1'],
  );
  assert.deepEqual(
    operations.find((operation) => operation.type === 'deleteMany')?.params.where.id.in,
    ['receipt-1'],
  );
  assert.equal(
    operations[0].params.where.OR[0].createdAt.lte.toISOString(),
    '2026-08-15T03:25:00.000Z',
  );
  assert.equal(operations[0].params.take, 500);
  assert.equal(operations[3].params.take, 500);
});
