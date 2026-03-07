import { PlatformUsageMetrics } from '../../domain/entities/platform-usage-metrics.entity';

export const PLATFORM_USAGE_METRICS_PORT = Symbol('PLATFORM_USAGE_METRICS_PORT');

export type PlatformOpenAiUsageInput = {
  model: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  brandId: string;
};

export type PlatformTwilioUsageInput = {
  messages?: number;
  costUsd?: number | null;
  brandId: string;
};

export type PlatformImageKitUsageInput = {
  storageUsedBytes: number;
  storageLimitBytes?: number | null;
  brandId: string;
};

export interface PlatformUsageMetricsPort {
  recordOpenAiUsage(input: PlatformOpenAiUsageInput): Promise<void>;
  recordTwilioUsage(input: PlatformTwilioUsageInput): Promise<void>;
  recordImageKitUsage(input: PlatformImageKitUsageInput): Promise<void>;
  refreshImageKitUsage(): Promise<void>;
  getPlatformMetrics(
    windowDays: number,
    options?: { forceOpenAi?: boolean },
  ): Promise<PlatformUsageMetrics>;
}

