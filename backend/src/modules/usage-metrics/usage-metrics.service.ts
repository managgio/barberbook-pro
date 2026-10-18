import { Inject, Injectable } from '@nestjs/common';
import { GetPlatformMetricsUseCase } from '../../contexts/platform/application/use-cases/get-platform-metrics.use-case';
import { RecordImageKitUsageUseCase } from '../../contexts/platform/application/use-cases/record-imagekit-usage.use-case';
import { RecordOpenAiUsageUseCase } from '../../contexts/platform/application/use-cases/record-openai-usage.use-case';
import { RecordMessagingUsageUseCase } from '../../contexts/platform/application/use-cases/record-messaging-usage.use-case';
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

type MessagingUsageParams = {
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
  private readonly recordMessagingUsageUseCase: RecordMessagingUsageUseCase;
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
    this.recordMessagingUsageUseCase = new RecordMessagingUsageUseCase(this.usageMetricsPort);
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

  private recordMessagingUsage(params: MessagingUsageParams & { channel: 'sms' | 'whatsapp' }) {
    return this.recordMessagingUsageUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      channel: params.channel,
      messages: params.messages,
      costUsd: params.costUsd,
      brandId: params.brandId,
    });
  }

  /** Provider-neutral entry point for SMS delivery. Storage remains backward-compatible. */
  recordSmsUsage(params: MessagingUsageParams) {
    return this.recordMessagingUsage({ ...params, channel: 'sms' });
  }

  /** Provider-neutral entry point for WhatsApp delivery. Storage remains backward-compatible. */
  recordWhatsappUsage(params: MessagingUsageParams) {
    return this.recordMessagingUsage({ ...params, channel: 'whatsapp' });
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
