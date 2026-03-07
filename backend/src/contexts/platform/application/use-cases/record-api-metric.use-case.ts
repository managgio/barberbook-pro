import { PlatformObservabilityPort } from '../../ports/outbound/platform-observability.port';
import { RecordApiMetricCommand } from '../commands/record-api-metric.command';

export class RecordApiMetricUseCase {
  constructor(private readonly observabilityPort: PlatformObservabilityPort) {}

  execute(command: RecordApiMetricCommand) {
    return this.observabilityPort.recordApiMetric(command.record);
  }
}

