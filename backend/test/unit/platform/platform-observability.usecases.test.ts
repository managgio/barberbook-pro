import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { GetApiMetricsSummaryUseCase } from '@/contexts/platform/application/use-cases/get-api-metrics-summary.use-case';
import { GetWebVitalsSummaryUseCase } from '@/contexts/platform/application/use-cases/get-web-vitals-summary.use-case';
import { RecordApiMetricUseCase } from '@/contexts/platform/application/use-cases/record-api-metric.use-case';
import { RecordWebVitalUseCase } from '@/contexts/platform/application/use-cases/record-web-vital.use-case';
import { RecordCriticalTraceUseCase } from '@/contexts/platform/application/use-cases/record-critical-trace.use-case';
import { GetCriticalTracesSummaryUseCase } from '@/contexts/platform/application/use-cases/get-critical-traces-summary.use-case';
import { UpdateCriticalTracePreferenceUseCase } from '@/contexts/platform/application/use-cases/update-critical-trace-preference.use-case';
import {
  CriticalTraceLevel,
  CriticalTraceOutcome,
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
    generatedAt: '2026-01-01T00:00:00.000Z',
    range: {
      start: '2025-12-31T23:00:00.000Z',
      end: '2026-01-01T00:00:00.000Z',
    },
    environment: 'test',
    totalEvents: 0,
    byMetric: [],
    topPoorPaths: [],
    tenantBreakdown: [],
  }),
  getApiMetricsSummary: async () => ({
    windowMinutes: 60,
    generatedAt: '2026-01-01T00:00:00.000Z',
    range: {
      start: '2025-12-31T23:00:00.000Z',
      end: '2026-01-01T00:00:00.000Z',
    },
    environment: 'test',
    totalEvents: 0,
    topRoutes: [],
    slowestSamples: [],
  }),
  recordCriticalTrace: async () => undefined,
  getCriticalTraceSummary: async () => ({
    windowMinutes: 60,
    page: 1,
    pageSize: 25,
    totalPages: 1,
    hasMore: false,
    generatedAt: '2026-01-01T00:00:00.000Z',
    range: { start: '2025-12-31T23:00:00.000Z', end: '2026-01-01T00:00:00.000Z' },
    environment: 'test',
    includeInPdf: true,
    totalEvents: 0,
    failedEvents: 0,
    traces: [],
  }),
  setCriticalTracePdfInclusion: async (includeInPdf) => ({ includeInPdf }),
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

test('critical trace forwards server-owned context to port', async () => {
  const calls: Array<{ traceId: string; userId: string | null }> = [];
  const useCase = new RecordCriticalTraceUseCase({
    ...basePort(),
    recordCriticalTrace: async (payload, context) => {
      calls.push({ traceId: payload.traceId, userId: context.user?.id ?? null });
    },
  });

  await useCase.execute({
    payload: {
      traceId: 'booking-trace-1',
      category: 'booking',
      stage: 'time_slot_selected',
      level: CriticalTraceLevel.INFO,
      outcome: CriticalTraceOutcome.SUCCEEDED,
      path: '/app/book',
    },
    context: {
      brandId: 'brand-1',
      localId: 'local-1',
      user: { id: 'user-1', name: 'Cliente', email: 'cliente@example.com' },
    },
  });

  assert.deepEqual(calls, [{ traceId: 'booking-trace-1', userId: 'user-1' }]);
});

test('critical trace summary preserves requested pagination and time window', async () => {
  const calls: Array<{ windowMinutes?: number; page?: number; pageSize?: number } | undefined> = [];
  const useCase = new GetCriticalTracesSummaryUseCase({
    ...basePort(),
    getCriticalTraceSummary: async (params) => {
      calls.push(params);
      return basePort().getCriticalTraceSummary(params);
    },
  });

  const result = await useCase.execute({ windowMinutes: 10_080, page: 2, pageSize: 50 });
  assert.deepEqual(calls, [{ windowMinutes: 10_080, page: 2, pageSize: 50 }]);
  assert.equal(result.includeInPdf, true);
});

test('critical trace PDF preference is persisted through its port', async () => {
  const calls: boolean[] = [];
  const useCase = new UpdateCriticalTracePreferenceUseCase({
    ...basePort(),
    setCriticalTracePdfInclusion: async (includeInPdf) => {
      calls.push(includeInPdf);
      return { includeInPdf };
    },
  });

  const result = await useCase.execute({ includeInPdf: false });
  assert.deepEqual(calls, [false]);
  assert.equal(result.includeInPdf, false);
});
