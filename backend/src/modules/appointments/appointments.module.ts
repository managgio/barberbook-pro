import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsStatusSyncService } from './appointments-status-sync.service';
import { AppointmentsRetentionService } from './appointments-retention.service';
import { AppointmentsController } from './appointments.controller';
import { HolidaysModule } from '../holidays/holidays.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LegalModule } from '../legal/legal.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { SettingsModule } from '../settings/settings.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AuthModule } from '../../auth/auth.module';
import { BarbersModule } from '../barbers/barbers.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    HolidaysModule,
    SchedulesModule,
    NotificationsModule,
    LegalModule,
    AuditLogsModule,
    SettingsModule,
    LoyaltyModule,
    ReferralsModule,
    ReviewsModule,
    AuthModule,
    BarbersModule,
    SubscriptionsModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentsStatusSyncService, AppointmentsRetentionService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
