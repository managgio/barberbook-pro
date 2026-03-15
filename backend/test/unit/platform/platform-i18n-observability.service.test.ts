import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformI18nObservabilityService } from '@/modules/platform-admin/platform-i18n-observability.service';
import { LocalizedTranslationStatus } from '@prisma/client';

test('getI18nOperationalOverview aggregates cross-tenant i18n health', async () => {
  const prisma = {
    brand: {
      findMany: async () => [
        {
          id: 'brand-1',
          name: 'Alpha',
          subdomain: 'alpha',
          isActive: true,
          config: {
            data: {
              i18n: {
                defaultLanguage: 'en',
                supportedLanguages: ['en', 'es'],
                autoTranslate: {
                  enabled: true,
                  monthlyRequestLimit: 100,
                  monthlyCharacterLimit: 10_000,
                  circuitBreaker: {
                    failureRateThreshold: 0.3,
                    minSamples: 2,
                  },
                },
              },
            },
          },
        },
        {
          id: 'brand-2',
          name: 'Bravo',
          subdomain: 'bravo',
          isActive: true,
          config: {
            data: {
              i18n: {
                defaultLanguage: 'es',
                supportedLanguages: ['es'],
                autoTranslate: {
                  enabled: true,
                  paused: true,
                  pauseReason: 'Mantenimiento',
                },
              },
            },
          },
        },
      ],
    },
    localizedContentTranslation: {
      groupBy: async (args: any) => {
        if (
          args.by?.length === 1 &&
          args.by[0] === 'brandId' &&
          args.where?.status === LocalizedTranslationStatus.pending
        ) {
          return [{ brandId: 'brand-1', _count: { _all: 12 } }];
        }
        if (
          args.by?.length === 2 &&
          args.by.includes('brandId') &&
          args.by.includes('status')
        ) {
          return [
            { brandId: 'brand-1', status: LocalizedTranslationStatus.ready, _count: { _all: 6 } },
            { brandId: 'brand-1', status: LocalizedTranslationStatus.failed, _count: { _all: 4 } },
            { brandId: 'brand-2', status: LocalizedTranslationStatus.ready, _count: { _all: 1 } },
          ];
        }
        throw new Error(`Unexpected groupBy call ${JSON.stringify(args)}`);
      },
      findMany: async () => [
        {
          brandId: 'brand-1',
          errorMessage: 'Provider timeout',
          updatedAt: new Date('2026-03-09T09:00:00.000Z'),
        },
      ],
    },
    $queryRaw: async () => [
      { brandId: 'brand-1', requests: 90, characters: 9_000 },
      { brandId: 'brand-2', requests: 3, characters: 280 },
    ],
  } as any;

  const platformService = {} as any;
  const service = new PlatformI18nObservabilityService(prisma, platformService);

  const result = await service.getI18nOperationalOverview(60);

  assert.equal(result.summary.totalTenants, 2);
  assert.equal(result.summary.pendingQueueTotal, 12);
  assert.equal(result.summary.highFailureTenants, 1);
  assert.equal(result.summary.pausedTenants, 1);
  assert.equal(result.summary.statuses.critical, 1);
  assert.equal(result.summary.statuses.paused, 1);

  const alpha = result.tenants.find((entry: any) => entry.brandId === 'brand-1');
  const bravo = result.tenants.find((entry: any) => entry.brandId === 'brand-2');

  assert.equal(alpha?.status, 'critical');
  assert.equal(alpha?.queue.pending, 12);
  assert.equal(alpha?.failureWindow.highFailure, true);
  assert.equal(alpha?.monthlyRequests.nearLimit, true);
  assert.equal(bravo?.status, 'paused');
  assert.equal(bravo?.pauseReason, 'Mantenimiento');
});

test('setTenantAutoTranslatePaused clears pause metadata when resuming', async () => {
  let updatedData: Record<string, unknown> | null = null;

  const prisma = {
    brand: {
      findUnique: async () => ({ id: 'brand-1' }),
    },
  } as any;

  const platformService = {
    getBrandConfig: async () => ({
      i18n: {
        defaultLanguage: 'es',
        supportedLanguages: ['es', 'en'],
        autoTranslate: {
          enabled: true,
          paused: true,
          pauseUntil: '2030-01-01T00:00:00.000Z',
          pauseReason: 'Legacy pause',
          retryAttempts: 2,
        },
      },
    }),
    updateBrandConfig: async (_brandId: string, data: Record<string, unknown>) => {
      updatedData = data;
      return { success: true };
    },
  } as any;

  const service = new PlatformI18nObservabilityService(prisma, platformService);
  const result = await service.setTenantAutoTranslatePaused({
    brandId: 'brand-1',
    paused: false,
  });

  assert.equal(result.success, true);
  assert.equal(result.paused, false);
  assert.ok(updatedData);

  const i18n = (updatedData as any).i18n;
  const auto = i18n.autoTranslate;
  assert.equal(auto.paused, false);
  assert.equal(Object.prototype.hasOwnProperty.call(auto, 'pauseUntil'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(auto, 'pauseReason'), false);
  assert.equal(auto.retryAttempts, 2);
});

