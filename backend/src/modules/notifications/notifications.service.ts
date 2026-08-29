import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ENGAGEMENT_NOTIFICATION_MANAGEMENT_PORT,
  EngagementNotificationAppointmentAction,
  EngagementNotificationAppointmentInfo,
  EngagementNotificationContactInfo,
  EngagementNotificationManagementPort,
  EngagementTestWhatsappInput,
} from '../../contexts/engagement/ports/outbound/notification-management.port';
import { NotificationDeliveryChannel, Prisma } from '@prisma/client';
import { NotificationDeliveryEnqueueOptions, NotificationDeliveryListFilters } from './notification-delivery.types';
import { NotificationDeliveryOutboxService } from './notification-delivery-outbox.service';
import { NotificationDeliveryHistoryService } from './notification-delivery-history.service';

const hasEmailRecipient = (contact: EngagementNotificationContactInfo) =>
  Boolean(contact.email?.trim());

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(ENGAGEMENT_NOTIFICATION_MANAGEMENT_PORT)
    private readonly notificationManagementPort: EngagementNotificationManagementPort,
    private readonly deliveryOutbox: NotificationDeliveryOutboxService,
    private readonly deliveryHistory: NotificationDeliveryHistoryService,
  ) {}

  sendAppointmentEmail(
    contact: EngagementNotificationContactInfo,
    appointment: EngagementNotificationAppointmentInfo,
    action: EngagementNotificationAppointmentAction,
    options: NotificationDeliveryEnqueueOptions = {},
  ) {
    if (!hasEmailRecipient(contact)) return Promise.resolve(null);
    return this.deliveryOutbox
      .enqueueAppointmentEmail(contact, appointment, action, options)
      .then((delivery) => this.dispatchNotificationDelivery(delivery.id));
  }

  enqueueAppointmentEmailInTransaction(
    contact: EngagementNotificationContactInfo,
    appointment: EngagementNotificationAppointmentInfo,
    action: EngagementNotificationAppointmentAction,
    options: NotificationDeliveryEnqueueOptions,
    transaction: Prisma.TransactionClient,
  ) {
    if (!hasEmailRecipient(contact)) return Promise.resolve(null);
    return this.deliveryOutbox.enqueueAppointmentEmail(contact, appointment, action, options, transaction);
  }

  async dispatchNotificationDelivery(deliveryId: string) {
    try {
      return await this.deliveryOutbox.dispatchDelivery(deliveryId);
    } catch (error) {
      this.logger.error(
        `Immediate notification outbox dispatch failed deliveryId=${deliveryId}; the worker will recover it`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  dispatchEmailDelivery(deliveryId: string) {
    return this.dispatchNotificationDelivery(deliveryId);
  }

  sendReferralRewardEmail(params: {
    contact: EngagementNotificationContactInfo;
    title: string;
    message: string;
    ctaLabel?: string;
    ctaUrl?: string;
  }) {
    return this.deliveryOutbox
      .enqueueReferralRewardEmail(params)
      .then((delivery) => this.dispatchNotificationDelivery(delivery.id));
  }

  sendBroadcastEmail(params: {
    contact: EngagementNotificationContactInfo;
    subject: string;
    message: string;
  }) {
    return this.deliveryOutbox.enqueueBroadcastEmail(params).then(async (delivery) => {
      const result = await this.dispatchNotificationDelivery(delivery.id);
      if (result?.status !== 'accepted') {
        throw new Error(`${result?.errorCode || 'EMAIL_DELIVERY_QUEUED'}: Email was not accepted on the first attempt.`);
      }
      return result;
    });
  }

  async queueBroadcastEmail(
    params: {
      contact: EngagementNotificationContactInfo;
      subject: string;
      message: string;
    },
    options: NotificationDeliveryEnqueueOptions,
  ) {
    const delivery = await this.deliveryOutbox.enqueueBroadcastEmail(params, options);
    const result = await this.dispatchNotificationDelivery(delivery.id);
    return { deliveryId: delivery.id, result };
  }

  async queueBroadcastNotification(
    channel: NotificationDeliveryChannel,
    params: {
      contact: EngagementNotificationContactInfo;
      title?: string;
      message: string;
      date?: string;
      time?: string;
    },
    options: NotificationDeliveryEnqueueOptions,
  ) {
    const delivery = await this.deliveryOutbox.enqueueBroadcastNotification(channel, params, options);
    const result = await this.dispatchNotificationDelivery(delivery.id);
    return { deliveryId: delivery.id, result };
  }

  listNotificationDeliveries(filters: NotificationDeliveryListFilters) {
    return this.deliveryHistory.listForCurrentTenant(filters);
  }

  listPlatformNotificationDeliveries(filters: NotificationDeliveryListFilters) {
    return this.deliveryHistory.listForPlatform(filters);
  }

  listPlatformNotificationDeliveryFilters() {
    return this.deliveryHistory.listPlatformFilterOptions();
  }

  retryNotificationDelivery(deliveryId: string) {
    return this.deliveryHistory.retryForCurrentTenant(deliveryId);
  }

  sendTestSms(phone: string, message?: string | null) {
    return this.notificationManagementPort.sendTestSms(phone, message);
  }

  sendTestWhatsapp(phone: string, options?: EngagementTestWhatsappInput) {
    return this.notificationManagementPort.sendTestWhatsapp(phone, options);
  }
}
