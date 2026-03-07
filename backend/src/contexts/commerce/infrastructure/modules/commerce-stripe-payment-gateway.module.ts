import { Module } from '@nestjs/common';
import { COMMERCE_STRIPE_PAYMENT_GATEWAY_PORT } from '../../ports/outbound/stripe-payment-gateway.port';
import { StripePaymentGatewayAdapter } from '../adapters/stripe-payment-gateway.adapter';

@Module({
  providers: [
    {
      provide: COMMERCE_STRIPE_PAYMENT_GATEWAY_PORT,
      useClass: StripePaymentGatewayAdapter,
    },
  ],
  exports: [COMMERCE_STRIPE_PAYMENT_GATEWAY_PORT],
})
export class CommerceStripePaymentGatewayModule {}
