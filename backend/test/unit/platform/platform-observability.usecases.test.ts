import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { GetApiMetricsSummaryUseCase } from '@/contexts/platform/application/use-cases/get-api-metrics-summary.use-case';
import { GetWebVitalsSummaryUseCase } from '@/contexts/platform/application/use-cases/get-web-vitals-summary.use-case';
import { RecordApiMetricUseCase } from '@/contexts/platform/application/use-cases/record-api-metric.use-case';
import { RecordWebVitalUseCase } from '@/contexts/platform/application/use-cases/record-web-vital.use-case';
import {
  PlatformApiMetricRecord,
  PlatformWebVitalName,
  PlatformWebVitalRating,
} from '@/contexts/platform/domain/entities/platform-observability.entity';
import { PlatformObservabilityPort } from '@/contexts/platform/ports/outbound/platform-observability.port';

const basePort = (): PlatformObservabilityPort => ({
  recordWebVital: async () => undefined,
  recordApiMetric: async () => undefined,
  getWebVitalsSummary: async () => ({
    windowMinutes: 60,
    totalEvents: 0,
    byMetric: [],
    topPoorPaths: [],
  }),
  getApiMetricsSummary: async () => ({
    windowMinutes: 60,
    totalEvents: 0,
    topRoutes: [],
    slowestSamples: [],
  }),
});

test('record web vital forwards payload and context to port', async () => {
  const calls: Array<{
    payload: { name: PlatformWebVitalName; rating: PlatformWebVitalRating };
    context: { localId: string; brandId: string };
  }> = [];
  const useCase = new RecordWebVitalUseCase({
    ...basePort(),
    recordWebVital: async (payload, context) => {
      calls.push({ payload, context });
    },
  });

  await useCase.execute({
    payload: {
      name: PlatformWebVitalName.LCP,
      value: 3200,
      rating: PlatformWebVitalRating.POOR,
      path: '/booking',
    },
    context: {
      localId: 'local-1',
      brandId: 'brand-1',
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.name, PlatformWebVitalName.LCP);
  assert.equal(calls[0].context.localId, 'local-1');
});

test('record api metric forwards record to port', async () => {
  const calls: PlatformApiMetricRecord[] = [];
  const useCase = new RecordApiMetricUseCase({
    ...basePort(),
    recordApiMetric: async (record) => {
      calls.push(record);
    },
  });

  await useCase.execute({
    record: {
      method: 'GET',
      route: '/api/services',
      statusCode: 200,
      durationMs: 42,
      timestamp: Date.now(),
      localId: 'local-1',
      brandId: 'brand-1',
      subdomain: 'leblond',
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].route, '/api/services');
});

test('get web vitals summary forwards optional window', async () => {
  const calls: Array<number | undefined> = [];
  const useCase = new GetWebVitalsSummaryUseCase({
    ...basePort(),
    getWebVitalsSummary: async (windowMinutes) => {
      calls.push(windowMinutes);
      return basePort().getWebVitalsSummary(windowMinutes);
    },
  });

  const result = await useCase.execute({ windowMinutes: 30 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 30);
  assert.equal(result.windowMinutes, 60);
});

test('get api metrics summary forwards optional window', async () => {
  const calls: Array<number | undefined> = [];
  const useCase = new GetApiMetricsSummaryUseCase({
    ...basePort(),
    getApiMetricsSummary: async (windowMinutes) => {
      calls.push(windowMinutes);
      return basePort().getApiMetricsSummary(windowMinutes);
    },
  });

  const result = await useCase.execute({ windowMinutes: 120 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 120);
  assert.equal(result.windowMinutes, 60);
});

