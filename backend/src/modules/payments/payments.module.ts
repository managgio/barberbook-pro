import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsPublicController } from './payments.public.controller';
import { PaymentsAdminController } from './payments.admin.controller';
import { PaymentsPlatformController } from './payments.platform.controller';
import { AppointmentsModule } from '../appointments/appointments.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { PaymentsScheduler } from './payments.scheduler';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AppointmentsModule, TenancyModule, AuthModule],
  providers: [PaymentsService, PaymentsScheduler, PlatformAdminGuard],
  controllers: [PaymentsPublicController, PaymentsAdminController, PaymentsPlatformController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
