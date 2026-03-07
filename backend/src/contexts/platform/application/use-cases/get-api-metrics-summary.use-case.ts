import { PlatformObservabilityPort } from '../../ports/outbound/platform-observability.port';
import { GetApiMetricsSummaryQuery } from '../queries/get-api-metrics-summary.query';

export class GetApiMetricsSummaryUseCase {
  constructor(private readonly observabilityPort: PlatformObservabilityPort) {}

  execute(query: GetApiMetricsSummaryQuery) {
    return this.observabilityPort.getApiMetricsSummary(query.windowMinutes);
  }
}

