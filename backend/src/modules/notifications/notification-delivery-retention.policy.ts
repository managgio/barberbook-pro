import { NotificationDeliveryStatus } from '@prisma/client';

export const NOTIFICATION_DELIVERY_RETENTION = {
  acceptedOrSkippedDays: 14,
  failedDays: 90,
  redactedReceiptDays: 365,
  batchSize: 500,
  maxBatchesPerRun: 20,
} as const;

export const resolvedStatuses = [
  NotificationDeliveryStatus.accepted,
  NotificationDeliveryStatus.skipped,
] as const;

export const subtractDays = (now: Date, days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60_000);
