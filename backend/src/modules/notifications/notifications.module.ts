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

@Module({
  imports: [SettingsModule, PrismaModule, TenancyModule, UsageMetricsModule, EngagementNotificationGatewayModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    SettingsTenantNotificationManagementAdapter,
    PrismaEngagementNotificationReminderAdapter,
    {
      provide: ENGAGEMENT_NOTIFICATION_MANAGEMENT_PORT,
      useExisting: SettingsTenantNotificationManagementAdapter,
    },
    {
      provide: ENGAGEMENT_NOTIFICATION_REMINDER_PORT,
      useExisting: PrismaEngagementNotificationReminderAdapter,
    },
    RemindersService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
