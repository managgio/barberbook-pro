import { Injectable, NotFoundException } from '@nestjs/common';
import {
  LocalizedTranslationSource,
  LocalizedTranslationStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformAdminService } from './platform-admin.service';

const DEFAULT_LANGUAGE = 'es';
const DEFAULT_FAILURE_RATE_THRESHOLD = 0.6;
const DEFAULT_MIN_SAMPLES = 12;
const NEAR_LIMIT_THRESHOLD = 0.8;

type I18nTenantStatus = 'ok' | 'warning' | 'critical' | 'paused';

type ParsedBrandI18nConfig = {
  defaultLanguage: string;
  supportedLanguages: string[];
  autoTranslateEnabled: boolean;
  paused: boolean;
  pauseUntil: string | null;
  pauseReason: string | null;
  monthlyRequestLimit: number | null;
  monthlyCharacterLimit: number | null;
  failureRateThreshold: number;
  minSamples: number;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const normalizeLanguageCode = (value?: unknown): string =>
  typeof value === 'string'
    ? value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 10)
    : '';

const toPositiveInt = (value: unknown, min: number, max: number): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
};

const toRatio = (value: unknown, min: number, max: number): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'bigint') return Number(value);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizePauseReason = (value?: string | null): string =>
  (value || '').trim().slice(0, 240);

@Injectable()
export class PlatformI18nObservabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformService: PlatformAdminService,
  ) {}

  async getI18nOperationalOverview(windowMinutes: number) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    const windowStart = new Date(Date.now() - Math.max(5, windowMinutes) * 60_000);

    const [brands, pendingRows, windowRows, usageRows, recentFailures] = await Promise.all([
      this.prisma.brand.findMany({
        select: {
          id: true,
          name: true,
          subdomain: true,
          isActive: true,
          config: {
            select: {
              data: true,
            },
          },
        },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.localizedContentTranslation.groupBy({
        by: ['brandId'],
        where: {
          status: LocalizedTranslationStatus.pending,
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.localizedContentTranslation.groupBy({
        by: ['brandId', 'status'],
        where: {
          source: LocalizedTranslationSource.ai,
          updatedAt: { gte: windowStart },
          status: {
            in: [LocalizedTranslationStatus.ready, LocalizedTranslationStatus.failed],
          },
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.$queryRaw<
        Array<{ brandId: string; requests: bigint | number; characters: bigint | number }>
      >(Prisma.sql`
        SELECT
          brandId,
          COUNT(*) AS requests,
          COALESCE(SUM(CHAR_LENGTH(TRIM(translatedText))), 0) AS characters
        FROM \`LocalizedContentTranslation\`
        WHERE source = 'ai'
          AND lastGeneratedAt IS NOT NULL
          AND lastGeneratedAt >= ${monthStart}
        GROUP BY brandId
      `),
      this.prisma.localizedContentTranslation.findMany({
        where: {
          source: LocalizedTranslationSource.ai,
          status: LocalizedTranslationStatus.failed,
          updatedAt: { gte: windowStart },
        },
        select: {
          brandId: true,
          errorMessage: true,
          updatedAt: true,
        },
        orderBy: [{ updatedAt: 'desc' }],
        distinct: ['brandId'],
      }),
    ]);

    const pendingByBrandId = new Map(
      pendingRows.map((row) => [row.brandId, row._count._all]),
    );

    const windowByBrandId = new Map<
      string,
      {
        total: number;
        failed: number;
      }
    >();
    for (const row of windowRows) {
      const current = windowByBrandId.get(row.brandId) || { total: 0, failed: 0 };
      current.total += row._count._all;
      if (row.status === LocalizedTranslationStatus.failed) current.failed += row._count._all;
      windowByBrandId.set(row.brandId, current);
    }

    const usageByBrandId = new Map<
      string,
      {
        requests: number;
        characters: number;
      }
    >();
    for (const row of usageRows) {
      usageByBrandId.set(row.brandId, {
        requests: toNumber(row.requests),
        characters: toNumber(row.characters),
      });
    }

    const recentFailuresByBrandId = new Map(
      recentFailures.map((row) => [row.brandId, row]),
    );

    const tenants = brands.map((brand) => {
      const config = this.parseBrandI18nConfig(brand.config?.data, now);
      const pendingCount = pendingByBrandId.get(brand.id) || 0;

      const windowStats = windowByBrandId.get(brand.id) || { total: 0, failed: 0 };
      const failureRate = windowStats.total > 0 ? windowStats.failed / windowStats.total : 0;
      const highFailure =
        windowStats.total >= config.minSamples && failureRate >= config.failureRateThreshold;

      const monthUsage = usageByBrandId.get(brand.id) || { requests: 0, characters: 0 };
      const requestRatio =
        config.monthlyRequestLimit && config.monthlyRequestLimit > 0
          ? monthUsage.requests / config.monthlyRequestLimit
          : null;
      const characterRatio =
        config.monthlyCharacterLimit && config.monthlyCharacterLimit > 0
          ? monthUsage.characters / config.monthlyCharacterLimit
          : null;

      const isNearLimit =
        (requestRatio !== null && requestRatio >= NEAR_LIMIT_THRESHOLD) ||
        (characterRatio !== null && characterRatio >= NEAR_LIMIT_THRESHOLD);
      const isOverLimit =
        (requestRatio !== null && requestRatio >= 1) ||
        (characterRatio !== null && characterRatio >= 1);

      const latestFailure = recentFailuresByBrandId.get(brand.id);
      const autoTranslatePaused = config.paused;

      let status: I18nTenantStatus = 'ok';
      if (autoTranslatePaused) {
        status = 'paused';
      } else if (isOverLimit || highFailure) {
        status = 'critical';
      } else if (!config.autoTranslateEnabled || isNearLimit || pendingCount > 0 || windowStats.failed > 0) {
        status = 'warning';
      }

      return {
        brandId: brand.id,
        brandName: brand.name,
        subdomain: brand.subdomain,
        isActive: brand.isActive,
        status,
        autoTranslateEnabled: config.autoTranslateEnabled,
        paused: autoTranslatePaused,
        pauseUntil: config.pauseUntil,
        pauseReason: config.pauseReason,
        languages: {
          defaultLanguage: config.defaultLanguage,
          supportedCount: config.supportedLanguages.length,
          supported: config.supportedLanguages,
        },
        queue: {
          pending: pendingCount,
        },
        failureWindow: {
          windowMinutes,
          totalSamples: windowStats.total,
          failedSamples: windowStats.failed,
          failureRate,
          highFailure,
          threshold: config.failureRateThreshold,
          minSamples: config.minSamples,
          latestErrorMessage: latestFailure?.errorMessage || null,
          latestErrorAt: latestFailure?.updatedAt?.toISOString?.() || null,
        },
        monthlyRequests: {
          used: monthUsage.requests,
          limit: config.monthlyRequestLimit,
          ratio: requestRatio,
          nearLimit: requestRatio !== null && requestRatio >= NEAR_LIMIT_THRESHOLD,
          overLimit: requestRatio !== null && requestRatio >= 1,
        },
        monthlyCharacters: {
          used: monthUsage.characters,
          limit: config.monthlyCharacterLimit,
          ratio: characterRatio,
          nearLimit: characterRatio !== null && characterRatio >= NEAR_LIMIT_THRESHOLD,
          overLimit: characterRatio !== null && characterRatio >= 1,
        },
      };
    });

    const statusPriority: Record<I18nTenantStatus, number> = {
      critical: 0,
      paused: 1,
      warning: 2,
      ok: 3,
    };

    tenants.sort((a, b) => {
      const statusDiff = statusPriority[a.status] - statusPriority[b.status];
      if (statusDiff !== 0) return statusDiff;
      if (b.queue.pending !== a.queue.pending) return b.queue.pending - a.queue.pending;
      if (b.failureWindow.failureRate !== a.failureWindow.failureRate) {
        return b.failureWindow.failureRate - a.failureWindow.failureRate;
      }
      return a.brandName.localeCompare(b.brandName);
    });

    const summary = tenants.reduce(
      (acc, tenant) => {
        acc.totalTenants += 1;
        if (tenant.isActive) acc.activeTenants += 1;
        if (tenant.paused) acc.pausedTenants += 1;
        if (tenant.failureWindow.highFailure) acc.highFailureTenants += 1;
        if (tenant.monthlyRequests.nearLimit || tenant.monthlyCharacters.nearLimit) {
          acc.nearLimitTenants += 1;
        }
        if (tenant.monthlyRequests.overLimit || tenant.monthlyCharacters.overLimit) {
          acc.overLimitTenants += 1;
        }
        if (!tenant.autoTranslateEnabled) acc.autoTranslateDisabledTenants += 1;
        acc.pendingQueueTotal += tenant.queue.pending;
        acc.statuses[tenant.status] += 1;
        return acc;
      },
      {
        totalTenants: 0,
        activeTenants: 0,
        pausedTenants: 0,
        nearLimitTenants: 0,
        overLimitTenants: 0,
        highFailureTenants: 0,
        autoTranslateDisabledTenants: 0,
        pendingQueueTotal: 0,
        statuses: {
          ok: 0,
          warning: 0,
          critical: 0,
          paused: 0,
        } as Record<I18nTenantStatus, number>,
      },
    );

    return {
      generatedAt: new Date().toISOString(),
      windowMinutes,
      nearLimitThreshold: NEAR_LIMIT_THRESHOLD,
      summary,
      tenants,
    };
  }

  async setTenantAutoTranslatePaused(params: {
    brandId: string;
    paused: boolean;
    reason?: string;
  }) {
    const brand = await this.prisma.brand.findUnique({
      where: { id: params.brandId },
      select: { id: true },
    });
    if (!brand) {
      throw new NotFoundException('Tenant no encontrado.');
    }

    const currentConfig = asRecord(await this.platformService.getBrandConfig(params.brandId));
    const i18nConfig = asRecord(currentConfig.i18n);
    const autoConfig = asRecord(i18nConfig.autoTranslate);

    const nextAutoConfig: Record<string, unknown> = { ...autoConfig };
    delete nextAutoConfig.pauseUntil;
    if (!params.paused) {
      delete nextAutoConfig.pauseReason;
    }

    if (params.paused) {
      nextAutoConfig.paused = true;
      const normalizedReason = normalizePauseReason(params.reason);
      nextAutoConfig.pauseReason = normalizedReason || 'PAUSA_MANUAL_PLATFORM';
    } else {
      nextAutoConfig.paused = false;
    }

    const nextConfig: Record<string, unknown> = {
      ...currentConfig,
      i18n: {
        ...i18nConfig,
        autoTranslate: nextAutoConfig,
      },
    };

    await this.platformService.updateBrandConfig(params.brandId, nextConfig);

    return {
      success: true,
      brandId: params.brandId,
      paused: params.paused,
      reason: params.paused ? String(nextAutoConfig.pauseReason || 'PAUSA_MANUAL_PLATFORM') : null,
    };
  }

  private parseBrandI18nConfig(configData: unknown, now: Date): ParsedBrandI18nConfig {
    const root = asRecord(configData);
    const i18n = asRecord(root.i18n);
    const auto = asRecord(i18n.autoTranslate);
    const circuitBreaker = asRecord(auto.circuitBreaker);

    const defaultLanguage = normalizeLanguageCode(i18n.defaultLanguage) || DEFAULT_LANGUAGE;

    const supportedLanguages = Array.from(
      new Set(
        [defaultLanguage, ...((Array.isArray(i18n.supportedLanguages) ? i18n.supportedLanguages : []) as unknown[])]
          .map((entry) => normalizeLanguageCode(entry))
          .filter(Boolean),
      ),
    );

    const pauseUntilRaw = typeof auto.pauseUntil === 'string' ? auto.pauseUntil.trim() : '';
    const pauseUntilDate = pauseUntilRaw ? new Date(pauseUntilRaw) : null;
    const pauseUntil =
      pauseUntilDate && !Number.isNaN(pauseUntilDate.getTime()) && pauseUntilDate > now
        ? pauseUntilDate.toISOString()
        : null;

    const pausedFlag = auto.paused === true;

    return {
      defaultLanguage,
      supportedLanguages: supportedLanguages.length > 0 ? supportedLanguages : [defaultLanguage],
      autoTranslateEnabled: auto.enabled !== false,
      paused: pausedFlag || Boolean(pauseUntil),
      pauseUntil,
      pauseReason: normalizePauseReason(typeof auto.pauseReason === 'string' ? auto.pauseReason : '') || null,
      monthlyRequestLimit: toPositiveInt(auto.monthlyRequestLimit, 1, 1_000_000),
      monthlyCharacterLimit: toPositiveInt(auto.monthlyCharacterLimit, 1, 500_000_000),
      failureRateThreshold:
        toRatio(circuitBreaker.failureRateThreshold, 0.05, 1) || DEFAULT_FAILURE_RATE_THRESHOLD,
      minSamples: toPositiveInt(circuitBreaker.minSamples, 1, 500) || DEFAULT_MIN_SAMPLES,
    };
  }
}

