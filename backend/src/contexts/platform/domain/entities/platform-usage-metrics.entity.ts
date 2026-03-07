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

