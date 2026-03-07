import { Module } from '@nestjs/common';
import { COMMERCE_PAYMENT_MANAGEMENT_PORT } from '../../contexts/commerce/ports/outbound/payment-management.port';
import { CommerceStripePaymentGatewayModule } from '../../contexts/commerce/infrastructure/modules/commerce-stripe-payment-gateway.module';
import { COMMERCE_PAYMENT_LIFECYCLE_PORT } from '../../contexts/commerce/ports/outbound/payment-lifecycle.port';
import { PaymentsService } from './payments.service';
import { PaymentsPublicController } from './payments.public.controller';
import { PaymentsAdminController } from './payments.admin.controller';
import { PaymentsPlatformController } from './payments.platform.controller';
import { AppointmentsModule } from '../appointments/appointments.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { PaymentsScheduler } from './payments.scheduler';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import { AuthModule } from '../../auth/auth.module';
import { PrismaPaymentLifecycleAdapter } from './adapters/prisma-payment-lifecycle.adapter';
import { PrismaStripePaymentManagementAdapter } from './adapters/prisma-stripe-payment-management.adapter';

@Module({
  imports: [AppointmentsModule, TenancyModule, AuthModule, CommerceStripePaymentGatewayModule],
  providers: [
    PrismaPaymentLifecycleAdapter,
    PrismaStripePaymentManagementAdapter,
    {
      provide: COMMERCE_PAYMENT_LIFECYCLE_PORT,
      useExisting: PrismaPaymentLifecycleAdapter,
    },
    {
      provide: COMMERCE_PAYMENT_MANAGEMENT_PORT,
      useExisting: PrismaStripePaymentManagementAdapter,
    },
    PaymentsService,
    PaymentsScheduler,
    PlatformAdminGuard,
  ],
  controllers: [PaymentsPublicController, PaymentsAdminController, PaymentsPlatformController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
