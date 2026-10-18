import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaPlatformUsageMetricsAdapter } from '@/modules/usage-metrics/adapters/prisma-platform-usage-metrics.adapter';

test('messaging metrics keep the legacy storage provider behind a neutral contract', async () => {
  const queriedProviders: string[] = [];
  const upserts: Array<Record<string, any>> = [];
  const prisma = {
    providerUsageDaily: {
      groupBy: async (query: Record<string, any>) => {
        const provider = String(query.where.provider);
        queriedProviders.push(provider);
        if (provider !== 'twilio') return [];
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

  await adapter.recordMessagingUsage({ brandId: 'brand-1', messages: 2, costUsd: 0.5 });
  const metrics = await adapter.getPlatformMetrics(7);

  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].where.provider_brandId_dateKey.provider, 'twilio');
  assert.equal(upserts[0].create.provider, 'twilio');
  assert.deepEqual(queriedProviders, ['twilio', 'imagekit']);
  assert.equal(metrics.messaging.series.at(-1)?.costUsd, 1.25);
  assert.equal(metrics.messaging.series.at(-1)?.messagesCount, 3);
  assert.equal('twilio' in metrics, false);
  assert.equal('twilioDailyCostUsd' in metrics.thresholds, false);
});
