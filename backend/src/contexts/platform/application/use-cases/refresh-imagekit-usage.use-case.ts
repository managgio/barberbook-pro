import { PlatformUsageMetricsPort } from '../../ports/outbound/platform-usage-metrics.port';

export class RefreshImageKitUsageUseCase {
  constructor(private readonly usageMetricsPort: PlatformUsageMetricsPort) {}

  execute() {
    return this.usageMetricsPort.refreshImageKitUsage();
  }
}

