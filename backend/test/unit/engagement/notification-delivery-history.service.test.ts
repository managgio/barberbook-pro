import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotificationDeliveryHistoryService } from '@/modules/notifications/notification-delivery-history.service';

test('tenant delivery history is paginated and restricted to enabled channels', async () => {
  let findManyQuery: any = null;
  const prisma: any = {
    notificationDelivery: {
      count: async () => 0,
      findMany: async (params: any) => {
        findManyQuery = params;
        return [];
      },
      groupBy: async () => [],
    },
    $transaction: async (promises: Promise<unknown>[]) => Promise.all(promises),
  };
  const service = new NotificationDeliveryHistoryService(
    prisma,
    { getRequestContext: () => ({ brandId: 'brand-1', localId: 'local-1' }) } as any,
    { getEffectiveConfig: async () => ({ notificationPrefs: { email: true, sms: true, whatsapp: false } }) } as any,
    {} as any,
  );

  const result = await service.listForCurrentTenant({ page: 3, pageSize: 25 });

  assert.deepEqual(result.enabledChannels, ['email', 'sms']);
  assert.equal(findManyQuery.skip, 50);
  assert.equal(findManyQuery.take, 25);
  const serializedWhere = JSON.stringify(findManyQuery.where);
  assert.match(serializedWhere, /brand-1/);
  assert.match(serializedWhere, /local-1/);
  assert.match(serializedWhere, /email/);
  assert.match(serializedWhere, /sms/);
  assert.doesNotMatch(serializedWhere, /whatsapp/);
  assert.match(serializedWhere, /retrying/);
  assert.match(serializedWhere, /failed/);
});
