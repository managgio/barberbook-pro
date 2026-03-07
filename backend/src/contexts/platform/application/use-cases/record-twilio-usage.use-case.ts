import { PlatformUsageMetricsPort } from '../../ports/outbound/platform-usage-metrics.port';
import { RecordTwilioUsageCommand } from '../commands/record-messaging-usage.command';

export class RecordTwilioUsageUseCase {
  constructor(private readonly usageMetricsPort: PlatformUsageMetricsPort) {}

  execute(command: RecordTwilioUsageCommand) {
    return this.usageMetricsPort.recordTwilioUsage({
      messages: command.messages,
      costUsd: command.costUsd,
      brandId: command.brandId ?? command.context.brandId,
    });
  }
}
