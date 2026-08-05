import { PlatformObservabilityPort } from '../../ports/outbound/platform-observability.port';

export class GetCriticalTracesSummaryUseCase {
  constructor(private readonly observabilityPort: PlatformObservabilityPort) {}

  execute(query: { windowMinutes?: number; page?: number; pageSize?: number }) {
    return this.observabilityPort.getCriticalTraceSummary(query);
  }
}
