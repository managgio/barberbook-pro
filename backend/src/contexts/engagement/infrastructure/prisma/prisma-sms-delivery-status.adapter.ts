import { Injectable } from '@nestjs/common';
import { NotificationDeliveryChannel, NotificationDeliveryStatus, Prisma } from '@prisma/client';
import { RecordSmsDeliveryStatusCommand } from '../../application/commands/record-sms-delivery-status.command';
import {
  EngagementSmsDeliveryStatusPort,
  RecordSmsDeliveryStatusResult,
} from '../../ports/outbound/sms-delivery-status.port';
import { PrismaService } from '../../../../prisma/prisma.service';

const ALLOWED_CURRENT_STATUSES: Record<
  RecordSmsDeliveryStatusCommand['status'],
  NotificationDeliveryStatus[]
> = {
  sent: [
    NotificationDeliveryStatus.processing,
    NotificationDeliveryStatus.accepted,
    NotificationDeliveryStatus.retrying,
    NotificationDeliveryStatus.failed,
    NotificationDeliveryStatus.sent,
  ],
  delivered: [
    NotificationDeliveryStatus.processing,
    NotificationDeliveryStatus.accepted,
    NotificationDeliveryStatus.retrying,
    NotificationDeliveryStatus.failed,
    NotificationDeliveryStatus.sent,
    NotificationDeliveryStatus.delivered,
  ],
  undelivered: [
    NotificationDeliveryStatus.processing,
    NotificationDeliveryStatus.accepted,
    NotificationDeliveryStatus.retrying,
    NotificationDeliveryStatus.failed,
    NotificationDeliveryStatus.sent,
    NotificationDeliveryStatus.undelivered,
  ],
  failed: [
    NotificationDeliveryStatus.processing,
    NotificationDeliveryStatus.accepted,
    NotificationDeliveryStatus.retrying,
    NotificationDeliveryStatus.failed,
  ],
};

const sanitizeProviderErrorCode = (value?: string | null) => {
  const sanitized = (value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40);
  return sanitized || null;
};

@Injectable()
export class PrismaSmsDeliveryStatusAdapter implements EngagementSmsDeliveryStatusPort {
  constructor(private readonly prisma: PrismaService) {}

  async record(command: RecordSmsDeliveryStatusCommand): Promise<RecordSmsDeliveryStatusResult> {
    // tenant-scope-ignore: this adapter is reachable only through a provider-signed callback and the
    // opaque per-attempt reference. The callback must update the originating tenant without browser context.
    const current = await this.prisma.notificationDelivery.findFirst({
      where: {
        activeAttemptReference: command.deliveryReference,
        channel: NotificationDeliveryChannel.sms,
        redactedAt: null,
      },
      select: {
        id: true,
        status: true,
        providerMessageId: true,
        attemptCount: true,
        acceptedAt: true,
        sentAt: true,
      },
    });
    if (!current) return { recorded: false, reason: 'not_found' };
    if (current.providerMessageId && current.providerMessageId !== command.providerMessageId) {
      return { recorded: false, reason: 'provider_message_mismatch' };
    }
    const allowedStatuses = ALLOWED_CURRENT_STATUSES[command.status];
    if (!allowedStatuses.includes(current.status)) {
      return { recorded: false, reason: 'stale_status' };
    }

    const providerErrorCode = sanitizeProviderErrorCode(command.providerErrorCode);
    const data: Prisma.NotificationDeliveryUpdateManyMutationInput = {
      providerMessageId: command.providerMessageId,
      deliveryStatusUpdatedAt: command.occurredAt,
      acceptedAt: current.acceptedAt || command.occurredAt,
      nextAttemptAt: null,
      processingStartedAt: null,
      failedAt: null,
      skippedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    };
    if (command.status === 'sent') {
      data.status = NotificationDeliveryStatus.sent;
      data.sentAt = current.sentAt || command.occurredAt;
    } else if (command.status === 'delivered') {
      data.status = NotificationDeliveryStatus.delivered;
      data.sentAt = current.sentAt || command.occurredAt;
      data.deliveredAt = command.occurredAt;
      data.undeliveredAt = null;
    } else if (command.status === 'undelivered') {
      data.status = NotificationDeliveryStatus.undelivered;
      data.sentAt = current.sentAt || command.occurredAt;
      data.undeliveredAt = command.occurredAt;
      data.deliveredAt = null;
      data.lastErrorCode = providerErrorCode
        ? `SMS_DELIVERY_UNDELIVERED_${providerErrorCode}`.slice(0, 100)
        : 'SMS_DELIVERY_UNDELIVERED';
      data.lastErrorMessage = 'The mobile carrier reported that the SMS could not be delivered.';
    } else {
      data.status = NotificationDeliveryStatus.failed;
      data.failedAt = command.occurredAt;
      data.undeliveredAt = null;
      data.deliveredAt = null;
      data.lastErrorCode = providerErrorCode
        ? `SMS_DELIVERY_FAILED_${providerErrorCode}`.slice(0, 100)
        : 'SMS_DELIVERY_FAILED';
      data.lastErrorMessage = 'The messaging provider reported that the SMS was not sent.';
    }

    const updated = await this.prisma.notificationDelivery.updateMany({
      where: {
        id: current.id,
        activeAttemptReference: command.deliveryReference,
        attemptCount: current.attemptCount,
        channel: NotificationDeliveryChannel.sms,
        redactedAt: null,
        status: { in: allowedStatuses },
        OR: [
          { providerMessageId: null },
          { providerMessageId: command.providerMessageId },
        ],
      },
      data,
    });
    return updated.count === 1
      ? { recorded: true, deliveryId: current.id }
      : { recorded: false, reason: 'stale_status' };
  }
}
