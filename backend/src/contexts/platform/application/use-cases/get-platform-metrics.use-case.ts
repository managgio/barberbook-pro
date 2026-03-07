import { PlatformUsageMetricsPort } from '../../ports/outbound/platform-usage-metrics.port';
import { GetPlatformMetricsQuery } from '../queries/get-platform-metrics.query';

export class GetPlatformMetricsUseCase {
  constructor(private readonly usageMetricsPort: PlatformUsageMetricsPort) {}

  execute(query: GetPlatformMetricsQuery) {
    return this.usageMetricsPort.getPlatformMetrics(query.windowDays, {
      forceOpenAi: query.forceOpenAi,
    });
  }
}

