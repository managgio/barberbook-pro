import { Module } from '@nestjs/common';
import { PrismaCashRegisterManagementAdapter } from '../../contexts/commerce/infrastructure/prisma/prisma-cash-register-management.adapter';
import { COMMERCE_CASH_REGISTER_MANAGEMENT_PORT } from '../../contexts/commerce/ports/outbound/cash-register-management.port';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { CashRegisterController } from './cash-register.controller';
import { CashRegisterService } from './cash-register.service';

@Module({
  imports: [PrismaModule, TenancyModule],
  controllers: [CashRegisterController],
  providers: [
    CashRegisterService,
    PrismaCashRegisterManagementAdapter,
    {
      provide: COMMERCE_CASH_REGISTER_MANAGEMENT_PORT,
      useExisting: PrismaCashRegisterManagementAdapter,
    },
  ],
})
export class CashRegisterModule {}
