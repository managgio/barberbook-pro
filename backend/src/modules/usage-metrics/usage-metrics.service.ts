import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ProviderUsageType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { getCurrentBrandId } from '../../tenancy/tenant.context';
import {
  AI_TIME_ZONE,
  addDays,
  getDateStringInTimeZone,
  getDayBoundsInTimeZone,
  parseDateString,
} from '../ai-assistant/ai-assistant.utils';

type OpenAiUsageParams = {
  model: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  brandId?: string;
};

type TwilioUsageParams = {
  messages?: number;
  costUsd?: number | null;
  brandId?: string;
};

type ImageKitUsageParams = {
  storageUsedBytes: number;
  storageLimitBytes?: number | null;
  brandId: string;
};

export type ProviderDailySeriesPoint = {
  dateKey: string;
  costUsd: number;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  messagesCount: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
};

export type PlatformUsageMetrics = {
  windowDays: number;
  range: { start: string; end: string };
  thresholds: {
    openaiDailyCostUsd: number | null;
    twilioDailyCostUsd: number | null;
    imagekitStorageBytes: number | null;
  };
  openai: { series: ProviderDailySeriesPoint[] };
  twilio: { series: ProviderDailySeriesPoint[] };
  imagekit: { series: ProviderDailySeriesPoint[] };
};

type OpenAiBucketBase<T = unknown> = {
  start_time: number;
  end_time?: number | null;
  results?: T[] | null;
};

type OpenAiCostResult = {
  amount?: { value?: number; currency?: string | null } | null;
  line_item?: string | null;
};

type OpenAiUsageResult = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  input_audio_tokens?: number | null;
  output_audio_tokens?: number | null;
};

type OpenAiCostBucket = OpenAiBucketBase<OpenAiCostResult>;
type OpenAiUsageBucket = OpenAiBucketBase<OpenAiUsageResult>;

const OPENAI_PRICING_USD_PER_1K: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4.1': { input: 0.01, output: 0.03 },
  'gpt-4.1-mini': { input: 0.0004, output: 0.0016 },
  'gpt-4.1-nano': { input: 0.0001, output: 0.0004 },
};

const parseNumber = (value?: string) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNumber = (value?: Prisma.Decimal | number | null) => {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
};

const OPENAI_ORG_CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class UsageMetricsService {
  private readonly logger = new Logger(UsageMetricsService.name);
  private readonly openAiOrgCache = new Map<string, { fetchedAt: number; series: ProviderDailySeriesPoint[] }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  async recordOpenAiUsage(params: OpenAiUsageParams) {
    const brandId = params.brandId || getCurrentBrandId();
    const dateKey = getDateStringInTimeZone(new Date(), AI_TIME_ZONE);
    const promptTokens = params.promptTokens ?? 0;
    const completionTokens = params.completionTokens ?? 0;
    const totalTokens = params.totalTokens ?? promptTokens + completionTokens;

    const costUsd = this.calculateOpenAiCost(params.model, promptTokens, completionTokens);
    await this.upsertUsage({
      provider: 'openai',
      brandId,
      dateKey,
      costUsd,
      tokensInput: promptTokens,
      tokensOutput: completionTokens,
      tokensTotal: totalTokens,
    });
  }

  async recordTwilioUsage(params: TwilioUsageParams) {
    const brandId = params.brandId || getCurrentBrandId();
    const dateKey = getDateStringInTimeZone(new Date(), AI_TIME_ZONE);
    await this.upsertUsage({
      provider: 'twilio',
      brandId,
      dateKey,
      costUsd: params.costUsd ?? null,
      messagesCount: params.messages ?? 1,
    });
  }

  async recordImageKitUsage(params: ImageKitUsageParams) {
    const dateKey = getDateStringInTimeZone(new Date(), AI_TIME_ZONE);
    await this.upsertUsage({
      provider: 'imagekit',
      brandId: params.brandId,
      dateKey,
      storageUsedBytes: params.storageUsedBytes,
      storageLimitBytes: params.storageLimitBytes ?? null,
    });
  }

  async refreshImageKitUsage() {
    const brands = await this.prisma.brand.findMany({ select: { id: true } });
    if (!brands.length) return;

    const usageCache = new Map<string, { used: number; limit: number | null }>();
    const recordedKeys = new Set<string>();

    for (const brand of brands) {
      const config = await this.tenantConfig.getBrandConfig(brand.id);
      const privateKey = config.imagekit?.privateKey;
      if (!privateKey) continue;
      if (recordedKeys.has(privateKey)) continue;

      let usage: { used: number; limit: number | null } | null | undefined = usageCache.get(privateKey);
      if (!usage) {
        usage = await this.fetchImageKitUsage(privateKey);
        if (usage) {
          usageCache.set(privateKey, usage);
        }
      }

      if (!usage) continue;
      await this.recordImageKitUsage({
        brandId: brand.id,
        storageUsedBytes: usage.used,
        storageLimitBytes: usage.limit,
      });
      recordedKeys.add(privateKey);
    }
  }

  async getPlatformMetrics(
    windowDays: number,
    options?: { forceOpenAi?: boolean },
  ): Promise<PlatformUsageMetrics> {
    const normalizedWindow = [7, 14, 30].includes(windowDays) ? windowDays : 7;
    const { dateKeys, start, end } = this.buildDateRange(normalizedWindow);

    const [openaiSeries, twilioRows, imagekitRows] = await Promise.all([
      this.getOpenAiOrganizationSeries(dateKeys, options?.forceOpenAi),
      this.prisma.providerUsageDaily.groupBy({
        by: ['dateKey'],
        where: { provider: 'twilio', dateKey: { in: dateKeys } },
        _sum: { costUsd: true, messagesCount: true },
      }),
      this.prisma.providerUsageDaily.groupBy({
        by: ['dateKey'],
        where: { provider: 'imagekit', dateKey: { in: dateKeys } },
        _sum: { storageUsedBytes: true, storageLimitBytes: true },
      }),
    ]);

    const twilioMap = new Map(
      twilioRows.map((row) => [
        row.dateKey,
        {
          costUsd: toNumber(row._sum.costUsd),
          messagesCount: row._sum.messagesCount ?? 0,
        },
      ]),
    );

    const imagekitMap = new Map(
      imagekitRows.map((row) => [
        row.dateKey,
        {
          storageUsedBytes: Number(row._sum.storageUsedBytes ?? 0),
          storageLimitBytes: Number(row._sum.storageLimitBytes ?? 0),
        },
      ]),
    );

    let lastStorageUsed = 0;
    let lastStorageLimit = 0;

    const twilioSeries = dateKeys.map((dateKey) => {
      const row = twilioMap.get(dateKey);
      return {
        dateKey,
        costUsd: row?.costUsd ?? 0,
        tokensInput: 0,
        tokensOutput: 0,
        tokensTotal: 0,
        messagesCount: row?.messagesCount ?? 0,
        storageUsedBytes: 0,
        storageLimitBytes: 0,
      };
    });

    const imagekitSeries = dateKeys.map((dateKey) => {
      const row = imagekitMap.get(dateKey);
      if (row) {
        lastStorageUsed = Number.isFinite(row.storageUsedBytes) ? row.storageUsedBytes : lastStorageUsed;
        lastStorageLimit = Number.isFinite(row.storageLimitBytes) ? row.storageLimitBytes : lastStorageLimit;
      }
      return {
        dateKey,
        costUsd: 0,
        tokensInput: 0,
        tokensOutput: 0,
        tokensTotal: 0,
        messagesCount: 0,
        storageUsedBytes: lastStorageUsed,
        storageLimitBytes: lastStorageLimit,
      };
    });

    return {
      windowDays: normalizedWindow,
      range: { start, end },
      thresholds: {
        openaiDailyCostUsd: this.getOpenAiDailyBudgetUsd(),
        twilioDailyCostUsd: this.getTwilioDailyBudgetUsd(),
        imagekitStorageBytes: this.getImagekitStorageLimitBytes(),
      },
      openai: { series: openaiSeries },
      twilio: { series: twilioSeries },
      imagekit: { series: imagekitSeries },
    };
  }

  private async getOpenAiOrganizationSeries(
    dateKeys: string[],
    forceRefresh = false,
  ): Promise<ProviderDailySeriesPoint[]> {
    const baseRange = this.buildDateRange(30);
    const cacheKey = baseRange.end;
    const cached = this.openAiOrgCache.get(cacheKey);
    if (cached && !forceRefresh && Date.now() - cached.fetchedAt < OPENAI_ORG_CACHE_TTL_MS) {
      const requested = new Set(dateKeys);
      return cached.series.filter((entry) => requested.has(entry.dateKey));
    }

    const adminKey = process.env.OPENAI_ADMIN_KEY;
    if (!adminKey) {
      this.logger.warn('Falta OPENAI_ADMIN_KEY para obtener costes y tokens reales.');
      return dateKeys.map((dateKey) => ({
        dateKey,
        costUsd: 0,
        tokensInput: 0,
        tokensOutput: 0,
        tokensTotal: 0,
        messagesCount: 0,
        storageUsedBytes: 0,
        storageLimitBytes: 0,
      }));
    }

    const range = this.buildOpenAiRange(baseRange.dateKeys);
    const costBuckets = await this.fetchOpenAiCosts(range.start, range.end, adminKey, baseRange.dateKeys.length);

    const costsByDate = new Map<string, number>();
    for (const bucket of costBuckets) {
      const dateKey = this.resolveBucketDate(bucket.start_time);
      if (!dateKey) continue;
      const cost = (bucket.results ?? []).reduce<number>((sum, entry) => {
        if (!this.isAllowedOpenAiCostLineItem(entry?.line_item)) return sum;
        const rawValue = entry?.amount?.value;
        const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue);
        const normalized = Number.isFinite(numeric) ? numeric : 0;
        return sum + normalized;
      }, 0);
      costsByDate.set(dateKey, cost);
    }

    const series = baseRange.dateKeys.map((dateKey) => {
      const costUsd = costsByDate.get(dateKey) ?? 0;
      return {
        dateKey,
        costUsd,
        tokensInput: 0,
        tokensOutput: 0,
        tokensTotal: 0,
        messagesCount: 0,
        storageUsedBytes: 0,
        storageLimitBytes: 0,
      };
    });
    this.openAiOrgCache.set(cacheKey, { fetchedAt: Date.now(), series });
    const requested = new Set(dateKeys);
    return series.filter((entry) => requested.has(entry.dateKey));
  }

  private buildOpenAiRange(dateKeys: string[]) {
    const startKey = dateKeys[0];
    const lastKey = dateKeys[dateKeys.length - 1];
    const nextKey = getDateStringInTimeZone(addDays(parseDateString(lastKey), 1), AI_TIME_ZONE);
    const start = getDayBoundsInTimeZone(startKey, AI_TIME_ZONE).start;
    const end = getDayBoundsInTimeZone(nextKey, AI_TIME_ZONE).start;
    return { start, end };
  }

  private resolveBucketDate(startTime?: number | null) {
    if (!startTime) return null;
    const date = new Date(startTime * 1000);
    return getDateStringInTimeZone(date, AI_TIME_ZONE);
  }

  private isAllowedOpenAiCostLineItem(lineItem?: string | null) {
    if (!lineItem) return true;
    const normalized = lineItem.toLowerCase();
    return !normalized.includes('image');
  }

  private async fetchOpenAiCosts(start: Date, end: Date, adminKey: string, limit?: number) {
    return this.fetchOpenAiBuckets<OpenAiCostBucket>(
      'https://api.openai.com/v1/organization/costs',
      start,
      end,
      adminKey,
      limit,
      ['line_item'],
    );
  }

  private async fetchOpenAiCompletionsUsage(start: Date, end: Date, adminKey: string, limit?: number) {
    return this.fetchOpenAiBuckets<OpenAiUsageBucket>(
      'https://api.openai.com/v1/organization/usage/completions',
      start,
      end,
      adminKey,
      limit,
    );
  }

  private async fetchOpenAiBuckets<T extends OpenAiBucketBase<any>>(
    endpoint: string,
    start: Date,
    end: Date,
    adminKey: string,
    limit?: number,
    groupBy?: string[],
  ): Promise<T[]> {
    const results: T[] = [];
    const startTime = Math.floor(start.getTime() / 1000);
    const endTime = Math.floor(end.getTime() / 1000);
    const bucketLimit = limit ? Math.min(180, Math.max(1, limit)) : undefined;
    let page: string | null = null;

    try {
      do {
        const url = new URL(endpoint);
        url.searchParams.set('start_time', String(startTime));
        url.searchParams.set('end_time', String(endTime));
        url.searchParams.set('bucket_width', '1d');
        if (bucketLimit) url.searchParams.set('limit', String(bucketLimit));
        (groupBy || []).forEach((value) => url.searchParams.append('group_by', value));
        if (page) url.searchParams.set('page', page);
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${adminKey}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          const message = await response.text();
          this.logger.warn(`OpenAI usage error: ${message || response.statusText}`);
          break;
        }
        const data = await response.json();
        const buckets = Array.isArray(data?.data) ? data.data : [];
        results.push(...(buckets as T[]));
        page = data?.next_page ?? null;
      } while (page);
    } catch (error) {
      this.logger.warn('Error consultando OpenAI organization metrics.');
    }

    return results;
  }

  private buildDateRange(windowDays: number) {
    const todayKey = getDateStringInTimeZone(new Date(), AI_TIME_ZONE);
    const startDate = addDays(parseDateString(todayKey), -(windowDays - 1));
    const dateKeys = Array.from({ length: windowDays }).map((_, index) =>
      getDateStringInTimeZone(addDays(startDate, index), AI_TIME_ZONE),
    );
    return {
      dateKeys,
      start: dateKeys[0],
      end: dateKeys[dateKeys.length - 1],
    };
  }

  private calculateOpenAiCost(model: string, promptTokens: number, completionTokens: number) {
    const normalized = model?.trim()?.toLowerCase();
    const pricing = normalized
      ? (OPENAI_PRICING_USD_PER_1K[normalized]
          || Object.entries(OPENAI_PRICING_USD_PER_1K).find(([key]) => normalized.startsWith(key))?.[1]
          || null)
      : null;
    const defaultInput = parseNumber(process.env.OPENAI_COST_INPUT_PER_1K_USD || '');
    const defaultOutput = parseNumber(process.env.OPENAI_COST_OUTPUT_PER_1K_USD || '');
    const inputRate = pricing?.input ?? defaultInput;
    const outputRate = pricing?.output ?? defaultOutput;
    if (!inputRate && !outputRate) return null;
    const inputCost = inputRate ? (promptTokens / 1000) * inputRate : 0;
    const outputCost = outputRate ? (completionTokens / 1000) * outputRate : 0;
    return inputCost + outputCost;
  }

  private async upsertUsage(params: {
    provider: ProviderUsageType;
    brandId: string;
    dateKey: string;
    costUsd?: number | null;
    tokensInput?: number;
    tokensOutput?: number;
    tokensTotal?: number;
    messagesCount?: number;
    storageUsedBytes?: number;
    storageLimitBytes?: number | null;
  }) {
    const update: Prisma.ProviderUsageDailyUpdateInput = {};
    const costUsd = params.costUsd ?? 0;
    update.costUsd = { increment: new Prisma.Decimal(costUsd) };
    const tokensInput = params.tokensInput ?? 0;
    const tokensOutput = params.tokensOutput ?? 0;
    const tokensTotal = params.tokensTotal ?? 0;
    const messagesCount = params.messagesCount ?? 0;
    update.tokensInput = { increment: tokensInput };
    update.tokensOutput = { increment: tokensOutput };
    update.tokensTotal = { increment: tokensTotal };
    update.messagesCount = { increment: messagesCount };
    if (params.storageUsedBytes !== undefined) {
      update.storageUsedBytes = params.storageUsedBytes;
    }
    if (params.storageLimitBytes !== undefined) {
      update.storageLimitBytes = params.storageLimitBytes ?? 0;
    }

    const create: Prisma.ProviderUsageDailyCreateInput = {
      provider: params.provider,
      dateKey: params.dateKey,
      brand: { connect: { id: params.brandId } },
      costUsd: new Prisma.Decimal(costUsd),
      tokensInput,
      tokensOutput,
      tokensTotal,
      messagesCount,
      storageUsedBytes: params.storageUsedBytes ?? 0,
      storageLimitBytes: params.storageLimitBytes ?? 0,
    };

    try {
      await this.prisma.providerUsageDaily.upsert({
        where: {
          provider_brandId_dateKey: {
            provider: params.provider,
            brandId: params.brandId,
            dateKey: params.dateKey,
          },
        },
        create,
        update,
      });
    } catch (error) {
      this.logger.warn(`No se pudo guardar métrica ${params.provider} para ${params.dateKey}.`);
    }
  }

  private getOpenAiDailyBudgetUsd() {
    return parseNumber(process.env.OPENAI_DAILY_BUDGET_USD || '') ?? null;
  }

  private getTwilioDailyBudgetUsd() {
    return parseNumber(process.env.TWILIO_DAILY_BUDGET_USD || '') ?? null;
  }

  private getImagekitStorageLimitBytes() {
    const bytes = parseNumber(process.env.IMAGEKIT_STORAGE_LIMIT_BYTES || '');
    if (bytes) return bytes;
    const gb = parseNumber(process.env.IMAGEKIT_STORAGE_LIMIT_GB || '');
    if (!gb) return null;
    return gb * 1024 * 1024 * 1024;
  }

  private async fetchImageKitUsage(privateKey: string) {
    try {
      const today = new Date();
      const endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startKey = startDate.toISOString().slice(0, 10);
      const endKey = endDate.toISOString().slice(0, 10);
      const response = await fetch(
        `https://api.imagekit.io/v1/accounts/usage?startDate=${startKey}&endDate=${endKey}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}`,
          },
        },
      );
      if (!response.ok) {
        const message = await response.text();
        this.logger.warn(`ImageKit usage error: ${message || response.statusText}`);
        return null;
      }
      const data = await response.json();
      const seriesCandidate = Array.isArray(data?.usage)
        ? data.usage
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : null;
      const payload = seriesCandidate?.length ? seriesCandidate[seriesCandidate.length - 1] : data;
      const mediaLibraryBytes = this.pickNumber(
        payload?.mediaLibraryStorageBytes,
        payload?.mediaLibrary?.storageBytes,
        payload?.mediaLibraryStorage,
        payload?.mediaLibrary?.storage,
      );
      const cacheBytes = this.pickNumber(
        payload?.originalCacheStorageBytes,
        payload?.cacheStorageBytes,
        payload?.originalCacheStorage,
        payload?.cacheStorage,
      );
      let used = NaN;
      if (Number.isFinite(mediaLibraryBytes) || Number.isFinite(cacheBytes)) {
        used = (Number.isFinite(mediaLibraryBytes) ? mediaLibraryBytes : 0)
          + (Number.isFinite(cacheBytes) ? cacheBytes : 0);
      }
      if (!Number.isFinite(used)) {
        used = this.pickNumber(
          payload?.storageUsed,
          payload?.storageUsedBytes,
          payload?.storage,
          payload?.storage?.used,
          payload?.storage?.total,
          payload?.usage?.storage,
          payload?.usage?.storageUsed,
        );
      }
      if (!Number.isFinite(used)) {
        this.logger.warn('ImageKit usage payload sin campo de almacenamiento reconocido.');
        return null;
      }
      const limit = this.pickNumber(
        payload?.storageLimit,
        payload?.storageLimitBytes,
        payload?.storage?.limit,
        payload?.storage?.max,
        payload?.usage?.storageLimit,
      );
      const fallbackLimit = this.getImagekitStorageLimitBytes();
      return { used, limit: Number.isFinite(limit) ? limit : fallbackLimit ?? null };
    } catch (error) {
      this.logger.warn('No se pudo consultar el uso de ImageKit.');
      return null;
    }
  }

  private pickNumber(...candidates: Array<number | string | null | undefined>) {
    for (const value of candidates) {
      if (value === null || value === undefined) continue;
      const parsed = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return NaN;
  }
}
