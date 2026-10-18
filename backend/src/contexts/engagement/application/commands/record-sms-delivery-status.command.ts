export const SMS_DELIVERY_RECEIPT_STATUSES = [
  'sent',
  'delivered',
  'undelivered',
  'failed',
] as const;

export type SmsDeliveryReceiptStatus = typeof SMS_DELIVERY_RECEIPT_STATUSES[number];

export type RecordSmsDeliveryStatusCommand = {
  deliveryReference: string;
  providerMessageId: string;
  status: SmsDeliveryReceiptStatus;
  providerErrorCode?: string | null;
  occurredAt: Date;
};
