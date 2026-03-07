import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { ENGAGEMENT_REFERRAL_ATTRIBUTION_MANAGEMENT_PORT } from '../../contexts/engagement/ports/outbound/referral-attribution-management.port';
import { ENGAGEMENT_REFERRAL_CODE_MANAGEMENT_PORT } from '../../contexts/engagement/ports/outbound/referral-code-management.port';
import { ENGAGEMENT_REFERRAL_CONFIG_MANAGEMENT_PORT } from '../../contexts/engagement/ports/outbound/referral-config-management.port';
import { ENGAGEMENT_REFERRAL_MAINTENANCE_PORT } from '../../contexts/engagement/ports/outbound/referral-maintenance.port';
import { ENGAGEMENT_REFERRAL_REWARD_MANAGEMENT_PORT } from '../../contexts/engagement/ports/outbound/referral-reward-management.port';
import { ENGAGEMENT_REFERRAL_TEMPLATE_MANAGEMENT_PORT } from '../../contexts/engagement/ports/outbound/referral-template-management.port';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscriptionsCommerceSubscriptionPolicyModule } from '../subscriptions/subscriptions-commerce-subscription-policy.module';
import { PrismaReferralAttributionManagementAdapter } from './adapters/prisma-referral-attribution-management.adapter';
import { PrismaReferralCodeManagementAdapter } from './adapters/prisma-referral-code-management.adapter';
import { PrismaReferralMaintenanceAdapter } from './adapters/prisma-referral-maintenance.adapter';
import { PrismaReferralTemplateManagementAdapter } from './adapters/prisma-referral-template-management.adapter';
import { PrismaSubscriptionReferralRewardManagementAdapter } from './adapters/prisma-subscription-referral-reward-management.adapter';
import { PrismaTenantReferralConfigManagementAdapter } from './adapters/prisma-tenant-referral-config-management.adapter';
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
  imports: [TenancyModule, NotificationsModule, AuthModule, SubscriptionsCommerceSubscriptionPolicyModule],
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
    PrismaReferralAttributionManagementAdapter,
    PrismaReferralCodeManagementAdapter,
    PrismaReferralMaintenanceAdapter,
    PrismaReferralTemplateManagementAdapter,
    PrismaTenantReferralConfigManagementAdapter,
    PrismaSubscriptionReferralRewardManagementAdapter,
    {
      provide: ENGAGEMENT_REFERRAL_ATTRIBUTION_MANAGEMENT_PORT,
      useExisting: PrismaReferralAttributionManagementAdapter,
    },
    {
      provide: ENGAGEMENT_REFERRAL_CONFIG_MANAGEMENT_PORT,
      useExisting: PrismaTenantReferralConfigManagementAdapter,
    },
    {
      provide: ENGAGEMENT_REFERRAL_TEMPLATE_MANAGEMENT_PORT,
      useExisting: PrismaReferralTemplateManagementAdapter,
    },
    {
      provide: ENGAGEMENT_REFERRAL_CODE_MANAGEMENT_PORT,
      useExisting: PrismaReferralCodeManagementAdapter,
    },
    {
      provide: ENGAGEMENT_REFERRAL_MAINTENANCE_PORT,
      useExisting: PrismaReferralMaintenanceAdapter,
    },
    {
      provide: ENGAGEMENT_REFERRAL_REWARD_MANAGEMENT_PORT,
      useExisting: PrismaSubscriptionReferralRewardManagementAdapter,
    },
    RewardsService,
    ReferralAnalyticsService,
    ReferralsSchedulerService,
  ],
  exports: [ReferralAttributionService, RewardsService, ReferralConfigService],
})
export class ReferralsModule {}
