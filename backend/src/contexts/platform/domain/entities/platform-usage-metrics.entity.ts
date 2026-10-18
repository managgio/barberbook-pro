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

export type MessagingTenantUsageBreakdown = {
  brandId: string;
  brandName: string;
  subdomain: string;
  costUsd: number;
  messagesCount: number;
};

export type PlatformUsageMetrics = {
  windowDays: number;
  range: { start: string; end: string };
  thresholds: {
    openaiDailyCostUsd: number | null;
    messagingDailyCostUsd: number | null;
    imagekitStorageBytes: number | null;
  };
  openai: { series: ProviderDailySeriesPoint[] };
  messaging: {
    series: ProviderDailySeriesPoint[];
    tenantBreakdown: MessagingTenantUsageBreakdown[];
  };
  imagekit: { series: ProviderDailySeriesPoint[] };
};
