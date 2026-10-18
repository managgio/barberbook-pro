import { PlatformUsageMetricsPort } from '../../ports/outbound/platform-usage-metrics.port';
import { RecordMessagingUsageCommand } from '../commands/record-messaging-usage.command';

export class RecordMessagingUsageUseCase {
  constructor(private readonly usageMetricsPort: PlatformUsageMetricsPort) {}

  execute(command: RecordMessagingUsageCommand) {
    return this.usageMetricsPort.recordMessagingUsage({
      messages: command.messages,
      costUsd: command.costUsd,
      brandId: command.brandId ?? command.context.brandId,
    });
  }
}
