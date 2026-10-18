import { Module } from '@nestjs/common';
import { EngagementNotificationGatewayModule } from '../../contexts/engagement/infrastructure/modules/engagement-notification-gateway.module';
import { ENGAGEMENT_NOTIFICATION_MANAGEMENT_PORT } from '../../contexts/engagement/ports/outbound/notification-management.port';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { RemindersService } from './reminders.service';
import { SettingsModule } from '../settings/settings.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsageMetricsModule } from '../usage-metrics/usage-metrics.module';
import { ENGAGEMENT_NOTIFICATION_REMINDER_PORT } from '../../contexts/engagement/ports/outbound/notification-reminder.port';
import { SettingsTenantNotificationManagementAdapter } from './adapters/settings-tenant-notification-management.adapter';
import { PrismaEngagementNotificationReminderAdapter } from './adapters/prisma-engagement-notification-reminder.adapter';
import { ObservabilityModule } from '../observability/observability.module';
import { NotificationDeliveryOutboxService } from './notification-delivery-outbox.service';
import { NotificationDeliveryWorkerService } from './notification-delivery-worker.service';
import { NotificationDeliveryHistoryService } from './notification-delivery-history.service';
import { NotificationDeliveryRetentionService } from './notification-delivery-retention.service';
import { ENGAGEMENT_NOTIFICATION_DELIVERY_QUEUE_PORT } from '../../contexts/engagement/ports/outbound/notification-delivery-queue.port';
import { OutboxNotificationDeliveryQueueAdapter } from './adapters/outbox-notification-delivery-queue.adapter';
import { NotificationDeliveryAttemptRecorder } from './notification-delivery-attempt-recorder.service';
import { NotificationDeliveryCriticalReporter } from './notification-delivery-critical-reporter.service';
import { TenantEmailConnectionVerifier } from './tenant-email-connection-verifier.service';
import { TwilioSmsStatusController } from './twilio-sms-status.controller';
import { TwilioSmsStatusWebhookAdapter } from '../../contexts/engagement/infrastructure/adapters/twilio-sms-status-webhook.adapter';
import { PrismaSmsDeliveryStatusAdapter } from '../../contexts/engagement/infrastructure/prisma/prisma-sms-delivery-status.adapter';
import { ENGAGEMENT_SMS_DELIVERY_STATUS_PORT } from '../../contexts/engagement/ports/outbound/sms-delivery-status.port';
import { PlatformSmsTestService } from './platform-sms-test.service';
import { GuestAppointmentAccessModule } from '../guest-appointment-access/guest-appointment-access.module';

@Module({
  imports: [
    SettingsModule,
    PrismaModule,
    TenancyModule,
    UsageMetricsModule,
    EngagementNotificationGatewayModule,
    ObservabilityModule,
    GuestAppointmentAccessModule,
  ],
  controllers: [NotificationsController, TwilioSmsStatusController],
  providers: [
    NotificationsService,
    SettingsTenantNotificationManagementAdapter,
    PrismaEngagementNotificationReminderAdapter,
    NotificationDeliveryOutboxService,
    NotificationDeliveryHistoryService,
    NotificationDeliveryWorkerService,
    NotificationDeliveryRetentionService,
    OutboxNotificationDeliveryQueueAdapter,
    NotificationDeliveryAttemptRecorder,
    NotificationDeliveryCriticalReporter,
    TenantEmailConnectionVerifier,
    TwilioSmsStatusWebhookAdapter,
    PrismaSmsDeliveryStatusAdapter,
    PlatformSmsTestService,
    {
      provide: ENGAGEMENT_NOTIFICATION_MANAGEMENT_PORT,
      useExisting: SettingsTenantNotificationManagementAdapter,
    },
    {
      provide: ENGAGEMENT_NOTIFICATION_REMINDER_PORT,
      useExisting: PrismaEngagementNotificationReminderAdapter,
    },
    {
      provide: ENGAGEMENT_NOTIFICATION_DELIVERY_QUEUE_PORT,
      useExisting: OutboxNotificationDeliveryQueueAdapter,
    },
    {
      provide: ENGAGEMENT_SMS_DELIVERY_STATUS_PORT,
      useExisting: PrismaSmsDeliveryStatusAdapter,
    },
    RemindersService,
  ],
  exports: [
    NotificationsService,
    NotificationDeliveryOutboxService,
    TenantEmailConnectionVerifier,
    PlatformSmsTestService,
  ],
})
export class NotificationsModule {}
