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

@Module({
  imports: [
    SettingsModule,
    PrismaModule,
    TenancyModule,
    UsageMetricsModule,
    EngagementNotificationGatewayModule,
    ObservabilityModule,
  ],
  controllers: [NotificationsController],
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
    RemindersService,
  ],
  exports: [NotificationsService, NotificationDeliveryOutboxService],
})
export class NotificationsModule {}
