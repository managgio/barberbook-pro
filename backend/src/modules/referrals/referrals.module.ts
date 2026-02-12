import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ReferralConfigService } from './referral-config.service';
import { ReferralTemplatesService } from './referral-templates.service';
import { ReferralCodeService } from './referral-code.service';
import { ReferralAttributionService } from './referral-attribution.service';
import { RewardsService } from './rewards.service';
import { ReferralAnalyticsService } from './referral-analytics.service';
import { ReferralsPublicController } from './referrals.public.controller';
import { ReferralsAdminController } from './referrals.admin.controller';
import { RewardsPublicController } from './rewards.public.controller';
import { ReferralsSchedulerService } from './referrals.scheduler';

@Module({
  imports: [TenancyModule, NotificationsModule, AuthModule, SubscriptionsModule],
  controllers: [
    ReferralsPublicController,
    RewardsPublicController,
    ReferralsAdminController,
  ],
  providers: [
    ReferralConfigService,
    ReferralTemplatesService,
    ReferralCodeService,
    ReferralAttributionService,
    RewardsService,
    ReferralAnalyticsService,
    ReferralsSchedulerService,
  ],
  exports: [ReferralAttributionService, RewardsService, ReferralConfigService],
})
export class ReferralsModule {}
