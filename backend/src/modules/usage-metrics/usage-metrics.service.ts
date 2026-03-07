import { Inject, Injectable } from '@nestjs/common';
import { GetPlatformMetricsUseCase } from '../../contexts/platform/application/use-cases/get-platform-metrics.use-case';
import { RecordImageKitUsageUseCase } from '../../contexts/platform/application/use-cases/record-imagekit-usage.use-case';
import { RecordOpenAiUsageUseCase } from '../../contexts/platform/application/use-cases/record-openai-usage.use-case';
import { RecordTwilioUsageUseCase } from '../../contexts/platform/application/use-cases/record-twilio-usage.use-case';
import { RefreshImageKitUsageUseCase } from '../../contexts/platform/application/use-cases/refresh-imagekit-usage.use-case';
import {
  PLATFORM_USAGE_METRICS_PORT,
  PlatformUsageMetricsPort,
} from '../../contexts/platform/ports/outbound/platform-usage-metrics.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { PlatformUsageMetrics } from '../../contexts/platform/domain/entities/platform-usage-metrics.entity';

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

@Injectable()
export class UsageMetricsService {
  private readonly recordOpenAiUsageUseCase: RecordOpenAiUsageUseCase;
  private readonly recordTwilioUsageUseCase: RecordTwilioUsageUseCase;
  private readonly recordImageKitUsageUseCase: RecordImageKitUsageUseCase;
  private readonly refreshImageKitUsageUseCase: RefreshImageKitUsageUseCase;
  private readonly getPlatformMetricsUseCase: GetPlatformMetricsUseCase;

  constructor(
    @Inject(PLATFORM_USAGE_METRICS_PORT)
    private readonly usageMetricsPort: PlatformUsageMetricsPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {
    this.recordOpenAiUsageUseCase = new RecordOpenAiUsageUseCase(this.usageMetricsPort);
    this.recordTwilioUsageUseCase = new RecordTwilioUsageUseCase(this.usageMetricsPort);
    this.recordImageKitUsageUseCase = new RecordImageKitUsageUseCase(this.usageMetricsPort);
    this.refreshImageKitUsageUseCase = new RefreshImageKitUsageUseCase(this.usageMetricsPort);
    this.getPlatformMetricsUseCase = new GetPlatformMetricsUseCase(this.usageMetricsPort);
  }

  recordOpenAiUsage(params: OpenAiUsageParams) {
    return this.recordOpenAiUsageUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      model: params.model,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens: params.totalTokens,
      brandId: params.brandId,
    });
  }

  recordTwilioUsage(params: TwilioUsageParams) {
    return this.recordTwilioUsageUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      messages: params.messages,
      costUsd: params.costUsd,
      brandId: params.brandId,
    });
  }

  recordImageKitUsage(params: ImageKitUsageParams) {
    return this.recordImageKitUsageUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      storageUsedBytes: params.storageUsedBytes,
      storageLimitBytes: params.storageLimitBytes,
      brandId: params.brandId,
    });
  }

  refreshImageKitUsage() {
    return this.refreshImageKitUsageUseCase.execute();
  }

  getPlatformMetrics(
    windowDays: number,
    options?: { forceOpenAi?: boolean },
  ): Promise<PlatformUsageMetrics> {
    return this.getPlatformMetricsUseCase.execute({
      windowDays,
      forceOpenAi: options?.forceOpenAi,
    });
  }
}
