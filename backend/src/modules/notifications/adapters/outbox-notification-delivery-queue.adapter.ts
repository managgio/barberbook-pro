import { Injectable, Logger } from '@nestjs/common';
import { EngagementNotificationDeliveryQueuePort } from '../../../contexts/engagement/ports/outbound/notification-delivery-queue.port';
import { NotificationDeliveryOutboxService } from '../notification-delivery-outbox.service';

@Injectable()
export class OutboxNotificationDeliveryQueueAdapter implements EngagementNotificationDeliveryQueuePort {
  private readonly logger = new Logger(OutboxNotificationDeliveryQueueAdapter.name);

  constructor(private readonly outbox: NotificationDeliveryOutboxService) {}

  async queueReminder(params: Parameters<EngagementNotificationDeliveryQueuePort['queueReminder']>[0]) {
    const delivery = await this.outbox.enqueueReminder(
      params.channel,
      params.contact,
      params.appointment,
      {
        appointmentId: params.appointmentId,
        idempotencyKey: `appointment:${params.appointmentId}:reminder:${params.channel}`,
      },
    );
    try {
      await this.outbox.dispatchDelivery(delivery.id);
    } catch (error) {
      this.logger.error(
        `Immediate reminder dispatch failed deliveryId=${delivery.id}; the outbox worker will retry it`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
