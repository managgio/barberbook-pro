import { Module } from '@nestjs/common';
import { COMMERCE_SUBSCRIPTION_MANAGEMENT_PORT } from '../../contexts/commerce/ports/outbound/subscription-management.port';
import { AuthModule } from '../../auth/auth.module';
import { CommerceStripePaymentGatewayModule } from '../../contexts/commerce/infrastructure/modules/commerce-stripe-payment-gateway.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { PrismaStripeSubscriptionManagementAdapter } from './adapters/prisma-stripe-subscription-management.adapter';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [PrismaModule, TenancyModule, AuthModule, CommerceStripePaymentGatewayModule],
  providers: [
    SubscriptionsService,
    PrismaStripeSubscriptionManagementAdapter,
    {
      provide: COMMERCE_SUBSCRIPTION_MANAGEMENT_PORT,
      useExisting: PrismaStripeSubscriptionManagementAdapter,
    },
  ],
  controllers: [SubscriptionsController],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
