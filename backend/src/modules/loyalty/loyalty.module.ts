import { Module } from '@nestjs/common';
import { COMMERCE_LOYALTY_MANAGEMENT_PORT } from '../../contexts/commerce/ports/outbound/loyalty-management.port';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { SubscriptionsCommerceSubscriptionPolicyModule } from '../subscriptions/subscriptions-commerce-subscription-policy.module';
import { PrismaSubscriptionLoyaltyManagementAdapter } from './adapters/prisma-subscription-loyalty-management.adapter';

@Module({
  imports: [PrismaModule, TenancyModule, SubscriptionsCommerceSubscriptionPolicyModule],
  providers: [
    LoyaltyService,
    PrismaSubscriptionLoyaltyManagementAdapter,
    {
      provide: COMMERCE_LOYALTY_MANAGEMENT_PORT,
      useExisting: PrismaSubscriptionLoyaltyManagementAdapter,
    },
  ],
  controllers: [LoyaltyController],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
