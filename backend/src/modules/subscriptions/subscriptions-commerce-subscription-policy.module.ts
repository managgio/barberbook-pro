import { Module } from '@nestjs/common';
import { COMMERCE_SUBSCRIPTION_POLICY_PORT } from '../../contexts/commerce/ports/outbound/subscription-policy.port';
import { SubscriptionsModule } from './subscriptions.module';
import { ModuleCommerceSubscriptionPolicyAdapter } from './adapters/module-commerce-subscription-policy.adapter';

@Module({
  imports: [SubscriptionsModule],
  providers: [
    {
      provide: COMMERCE_SUBSCRIPTION_POLICY_PORT,
      useClass: ModuleCommerceSubscriptionPolicyAdapter,
    },
  ],
  exports: [COMMERCE_SUBSCRIPTION_POLICY_PORT],
})
export class SubscriptionsCommerceSubscriptionPolicyModule {}
