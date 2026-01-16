import { Module } from '@nestjs/common';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { NotificationsService } from './notifications.service';
import { RemindersService } from './reminders.service';
import { SettingsModule } from '../settings/settings.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsageMetricsModule } from '../usage-metrics/usage-metrics.module';

@Module({
  imports: [SettingsModule, PrismaModule, TenancyModule, UsageMetricsModule],
  providers: [NotificationsService, RemindersService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
