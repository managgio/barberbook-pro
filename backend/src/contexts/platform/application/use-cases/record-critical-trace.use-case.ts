import {
  CriticalTraceContext,
  CriticalTraceLevel,
  CriticalTraceOutcome,
  CriticalTraceReport,
} from '../../domain/entities/platform-observability.entity';
import { PlatformObservabilityPort } from '../../ports/outbound/platform-observability.port';

export class RecordCriticalTraceUseCase {
  constructor(private readonly observabilityPort: PlatformObservabilityPort) {}

  execute(command: { payload: CriticalTraceReport; context: CriticalTraceContext }) {
    if (
      command.payload.outcome !== CriticalTraceOutcome.FAILED
      && command.payload.level !== CriticalTraceLevel.ERROR
    ) {
      return Promise.resolve();
    }
    return this.observabilityPort.recordCriticalTrace(command.payload, command.context);
  }
}
