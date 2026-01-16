import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ProviderUsageType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentBrandId } from '../../tenancy/tenant.context';
import { AI_TIME_ZONE, addDays, getDateStringInTimeZone, parseDateString } from '../ai-assistant/ai-assistant.utils';

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

@Injectable()
export class UsageMetricsService {
  private readonly logger = new Logger(UsageMetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
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

  async getPlatformMetrics(windowDays: number): Promise<PlatformUsageMetrics> {
    const normalizedWindow = [7, 14, 30].includes(windowDays) ? windowDays : 7;
    const { dateKeys, start, end } = this.buildDateRange(normalizedWindow);

    const [openaiRows, twilioRows, imagekitRows] = await Promise.all([
      this.prisma.providerUsageDaily.groupBy({
        by: ['dateKey'],
        where: { provider: 'openai', dateKey: { in: dateKeys } },
        _sum: { costUsd: true, tokensInput: true, tokensOutput: true, tokensTotal: true },
      }),
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

    const openaiMap = new Map(
      openaiRows.map((row) => [
        row.dateKey,
        {
          costUsd: toNumber(row._sum.costUsd),
          tokensInput: row._sum.tokensInput ?? 0,
          tokensOutput: row._sum.tokensOutput ?? 0,
          tokensTotal: row._sum.tokensTotal ?? 0,
        },
      ]),
    );

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

    const openaiSeries = dateKeys.map((dateKey) => {
      const row = openaiMap.get(dateKey);
      return {
        dateKey,
        costUsd: row?.costUsd ?? 0,
        tokensInput: row?.tokensInput ?? 0,
        tokensOutput: row?.tokensOutput ?? 0,
        tokensTotal: row?.tokensTotal ?? 0,
        messagesCount: 0,
        storageUsedBytes: 0,
        storageLimitBytes: 0,
      };
    });

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
}
