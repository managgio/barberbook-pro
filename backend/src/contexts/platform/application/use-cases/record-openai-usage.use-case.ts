import { PlatformUsageMetricsPort } from '../../ports/outbound/platform-usage-metrics.port';
import { RecordOpenAiUsageCommand } from '../commands/record-llm-usage.command';

export class RecordOpenAiUsageUseCase {
  constructor(private readonly usageMetricsPort: PlatformUsageMetricsPort) {}

  execute(command: RecordOpenAiUsageCommand) {
    return this.usageMetricsPort.recordOpenAiUsage({
      model: command.model,
      promptTokens: command.promptTokens,
      completionTokens: command.completionTokens,
      totalTokens: command.totalTokens,
      brandId: command.brandId ?? command.context.brandId,
    });
  }
}
