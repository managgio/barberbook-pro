import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { GetPlatformMetricsUseCase } from '@/contexts/platform/application/use-cases/get-platform-metrics.use-case';
import { RecordImageKitUsageUseCase } from '@/contexts/platform/application/use-cases/record-imagekit-usage.use-case';
import { RecordOpenAiUsageUseCase } from '@/contexts/platform/application/use-cases/record-openai-usage.use-case';
import { RecordTwilioUsageUseCase } from '@/contexts/platform/application/use-cases/record-twilio-usage.use-case';
import { RefreshImageKitUsageUseCase } from '@/contexts/platform/application/use-cases/refresh-imagekit-usage.use-case';
import {
  PlatformOpenAiUsageInput,
  PlatformTwilioUsageInput,
  PlatformImageKitUsageInput,
  PlatformUsageMetricsPort,
} from '@/contexts/platform/ports/outbound/platform-usage-metrics.port';

const context = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: 'user-1',
  timezone: 'Europe/Madrid',
  correlationId: 'corr-platform-usage-1',
};

const basePort = (): PlatformUsageMetricsPort => ({
  recordOpenAiUsage: async () => undefined,
  recordTwilioUsage: async () => undefined,
  recordImageKitUsage: async () => undefined,
  refreshImageKitUsage: async () => undefined,
  getPlatformMetrics: async () => ({
    windowDays: 7,
    range: { start: '2026-03-01', end: '2026-03-07' },
    thresholds: {
      openaiDailyCostUsd: null,
      twilioDailyCostUsd: null,
      imagekitStorageBytes: null,
    },
    openai: { series: [] },
    twilio: { series: [] },
    imagekit: { series: [] },
  }),
});

test('record openai usage resolves brand from context when omitted', async () => {
  const calls: PlatformOpenAiUsageInput[] = [];
  const useCase = new RecordOpenAiUsageUseCase({
    ...basePort(),
    recordOpenAiUsage: async (input) => {
      calls.push(input);
    },
  });

  await useCase.execute({
    context,
    model: 'gpt-4o-mini',
    promptTokens: 100,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].brandId, context.brandId);
  assert.equal(calls[0].model, 'gpt-4o-mini');
});

test('record twilio usage keeps explicit brand override', async () => {
  const calls: PlatformTwilioUsageInput[] = [];
  const useCase = new RecordTwilioUsageUseCase({
    ...basePort(),
    recordTwilioUsage: async (input) => {
      calls.push(input);
    },
  });

  await useCase.execute({
    context,
    brandId: 'brand-override',
    messages: 2,
    costUsd: 0.4,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].brandId, 'brand-override');
  assert.equal(calls[0].messages, 2);
});

test('record imagekit usage resolves brand from context when omitted', async () => {
  const calls: PlatformImageKitUsageInput[] = [];
  const useCase = new RecordImageKitUsageUseCase({
    ...basePort(),
    recordImageKitUsage: async (input) => {
      calls.push(input);
    },
  });

  await useCase.execute({
    context,
    storageUsedBytes: 123,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].brandId, context.brandId);
  assert.equal(calls[0].storageUsedBytes, 123);
});

test('refresh imagekit usage delegates to port', async () => {
  let called = 0;
  const useCase = new RefreshImageKitUsageUseCase({
    ...basePort(),
    refreshImageKitUsage: async () => {
      called += 1;
    },
  });

  await useCase.execute();
  assert.equal(called, 1);
});

test('get platform metrics forwards query options', async () => {
  const calls: Array<{ windowDays: number; forceOpenAi?: boolean }> = [];
  const useCase = new GetPlatformMetricsUseCase({
    ...basePort(),
    getPlatformMetrics: async (windowDays, options) => {
      calls.push({ windowDays, forceOpenAi: options?.forceOpenAi });
      return basePort().getPlatformMetrics(7);
    },
  });

  const result = await useCase.execute({ windowDays: 14, forceOpenAi: true });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { windowDays: 14, forceOpenAi: true });
  assert.equal(result.windowDays, 7);
});

