import { PlatformObservabilityPort } from '../../ports/outbound/platform-observability.port';
import { GetWebVitalsSummaryQuery } from '../queries/get-web-vitals-summary.query';

export class GetWebVitalsSummaryUseCase {
  constructor(private readonly observabilityPort: PlatformObservabilityPort) {}

  execute(query: GetWebVitalsSummaryQuery) {
    return this.observabilityPort.getWebVitalsSummary(query.windowMinutes);
  }
}

