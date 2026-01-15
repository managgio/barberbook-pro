import { Module } from '@nestjs/common';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { NotificationsService } from './notifications.service';
import { RemindersService } from './reminders.service';
import { SettingsModule } from '../settings/settings.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [SettingsModule, PrismaModule, TenancyModule],
  providers: [NotificationsService, RemindersService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
