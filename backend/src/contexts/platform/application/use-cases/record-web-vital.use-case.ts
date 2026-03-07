import { PlatformObservabilityPort } from '../../ports/outbound/platform-observability.port';
import { RecordWebVitalCommand } from '../commands/record-web-vital.command';

export class RecordWebVitalUseCase {
  constructor(private readonly observabilityPort: PlatformObservabilityPort) {}

  execute(command: RecordWebVitalCommand) {
    return this.observabilityPort.recordWebVital(command.payload, command.context);
  }
}

