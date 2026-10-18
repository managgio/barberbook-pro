import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaPlatformUsageMetricsAdapter } from '@/modules/usage-metrics/adapters/prisma-platform-usage-metrics.adapter';

test('SMS metrics stay tenant-attributed and exclude other messaging channels', async () => {
  const groupByQueries: Array<Record<string, any>> = [];
  const upserts: Array<Record<string, any>> = [];
  const prisma = {
    brand: {
      findMany: async () => [
        { id: 'brand-1', name: 'Le Blond', subdomain: 'leblond' },
        { id: 'brand-2', name: 'Ronin', subdomain: 'ronin' },
      ],
    },
    providerUsageDaily: {
      groupBy: async (query: Record<string, any>) => {
        groupByQueries.push(query);
        if (query.where.provider === 'imagekit') return [];
        if (query.where.provider !== 'twilio' || query.where.usageChannel !== 'sms') return [];
        if (query.by.includes('brandId')) {
          return [
            { brandId: 'brand-2', _sum: { costUsd: 0.25, messagesCount: 1 } },
            { brandId: 'brand-1', _sum: { costUsd: 1, messagesCount: 2 } },
          ];
        }
        const dateKeys = query.where.dateKey.in as string[];
        return [{
          dateKey: dateKeys[dateKeys.length - 1],
          _sum: { costUsd: 1.25, messagesCount: 3 },
        }];
      },
      upsert: async (query: Record<string, any>) => {
        upserts.push(query);
        return {};
      },
    },
  };
  const adapter = new PrismaPlatformUsageMetricsAdapter(prisma as any, {} as any);
  (adapter as any).getOpenAiOrganizationSeries = async (dateKeys: string[]) => dateKeys.map((dateKey) => ({
    dateKey,
    costUsd: 0,
    tokensInput: 0,
    tokensOutput: 0,
    tokensTotal: 0,
    messagesCount: 0,
    storageUsedBytes: 0,
    storageLimitBytes: 0,
  }));

  await adapter.recordMessagingUsage({
    brandId: 'brand-1',
    channel: 'sms',
    messages: 2,
    costUsd: 0.5,
  });
  await adapter.recordMessagingUsage({
    brandId: 'brand-1',
    channel: 'whatsapp',
    messages: 1,
    costUsd: 0.2,
  });
  const metrics = await adapter.getPlatformMetrics(7);

  assert.equal(upserts.length, 2);
  assert.equal(
    upserts[0].where.provider_usageChannel_brandId_dateKey.usageChannel,
    'sms',
  );
  assert.equal(upserts[0].create.provider, 'twilio');
  assert.equal(upserts[0].create.usageChannel, 'sms');
  assert.equal(
    upserts[1].where.provider_usageChannel_brandId_dateKey.usageChannel,
    'whatsapp',
  );

  const messagingQueries = groupByQueries.filter((query) => query.where.provider === 'twilio');
  assert.equal(messagingQueries.length, 2);
  assert.equal(messagingQueries.every((query) => query.where.usageChannel === 'sms'), true);
  assert.equal(metrics.messaging.series.at(-1)?.costUsd, 1.25);
  assert.equal(metrics.messaging.series.at(-1)?.messagesCount, 3);
  assert.deepEqual(metrics.messaging.tenantBreakdown, [
    {
      brandId: 'brand-1',
      brandName: 'Le Blond',
      subdomain: 'leblond',
      costUsd: 1,
      messagesCount: 2,
    },
    {
      brandId: 'brand-2',
      brandName: 'Ronin',
      subdomain: 'ronin',
      costUsd: 0.25,
      messagesCount: 1,
    },
  ]);
  assert.equal('twilio' in metrics, false);
  assert.equal('twilioDailyCostUsd' in metrics.thresholds, false);
});
