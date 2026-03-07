import { Injectable } from '@nestjs/common';
import { AiUsageMetricsPort } from '../../../contexts/ai-orchestration/ports/outbound/ai-usage-metrics.port';
import { UsageMetricsService } from '../../usage-metrics/usage-metrics.service';

@Injectable()
export class ModuleAiUsageMetricsAdapter implements AiUsageMetricsPort {
  constructor(private readonly usageMetricsService: UsageMetricsService) {}

  recordOpenAiUsage(input: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }): Promise<void> {
    return this.usageMetricsService.recordOpenAiUsage(input);
  }
}
