import { PlatformUsageMetricsPort } from '../../ports/outbound/platform-usage-metrics.port';
import { RecordImageKitUsageCommand } from '../commands/record-storage-usage.command';

export class RecordImageKitUsageUseCase {
  constructor(private readonly usageMetricsPort: PlatformUsageMetricsPort) {}

  execute(command: RecordImageKitUsageCommand) {
    return this.usageMetricsPort.recordImageKitUsage({
      storageUsedBytes: command.storageUsedBytes,
      storageLimitBytes: command.storageLimitBytes,
      brandId: command.brandId ?? command.context.brandId,
    });
  }
}
