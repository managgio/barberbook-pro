import {
  CriticalTraceContext,
  CriticalTraceReport,
} from '../../domain/entities/platform-observability.entity';
import { PlatformObservabilityPort } from '../../ports/outbound/platform-observability.port';

export class RecordCriticalTraceUseCase {
  constructor(private readonly observabilityPort: PlatformObservabilityPort) {}

  execute(command: { payload: CriticalTraceReport; context: CriticalTraceContext }) {
    return this.observabilityPort.recordCriticalTrace(command.payload, command.context);
  }
}
