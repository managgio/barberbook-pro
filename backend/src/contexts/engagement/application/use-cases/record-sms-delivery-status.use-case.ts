import { RecordSmsDeliveryStatusCommand } from '../commands/record-sms-delivery-status.command';
import {
  EngagementSmsDeliveryStatusPort,
  RecordSmsDeliveryStatusResult,
} from '../../ports/outbound/sms-delivery-status.port';

export class RecordSmsDeliveryStatusUseCase {
  constructor(private readonly deliveryStatusPort: EngagementSmsDeliveryStatusPort) {}

  execute(command: RecordSmsDeliveryStatusCommand): Promise<RecordSmsDeliveryStatusResult> {
    return this.deliveryStatusPort.record(command);
  }
}
