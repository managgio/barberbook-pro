import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsPublicController } from './payments.public.controller';
import { PaymentsAdminController } from './payments.admin.controller';
import { PaymentsPlatformController } from './payments.platform.controller';
import { AppointmentsModule } from '../appointments/appointments.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { PaymentsScheduler } from './payments.scheduler';

@Module({
  imports: [AppointmentsModule, TenancyModule],
  providers: [PaymentsService, PaymentsScheduler],
  controllers: [PaymentsPublicController, PaymentsAdminController, PaymentsPlatformController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
