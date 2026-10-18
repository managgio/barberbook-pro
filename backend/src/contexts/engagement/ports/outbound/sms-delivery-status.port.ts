import { RecordSmsDeliveryStatusCommand } from '../../application/commands/record-sms-delivery-status.command';

export const ENGAGEMENT_SMS_DELIVERY_STATUS_PORT = Symbol('ENGAGEMENT_SMS_DELIVERY_STATUS_PORT');

export type RecordSmsDeliveryStatusResult =
  | { recorded: true; deliveryId: string }
  | { recorded: false; reason: 'not_found' | 'provider_message_mismatch' | 'stale_status' };

export interface EngagementSmsDeliveryStatusPort {
  record(command: RecordSmsDeliveryStatusCommand): Promise<RecordSmsDeliveryStatusResult>;
}
