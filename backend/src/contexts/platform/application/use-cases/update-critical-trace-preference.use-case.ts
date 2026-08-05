import { PlatformObservabilityPort } from '../../ports/outbound/platform-observability.port';

export class UpdateCriticalTracePreferenceUseCase {
  constructor(private readonly observabilityPort: PlatformObservabilityPort) {}

  execute(command: { includeInPdf: boolean }) {
    return this.observabilityPort.setCriticalTracePdfInclusion(command.includeInPdf);
  }
}
