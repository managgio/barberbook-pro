import { Module } from '@nestjs/common';
import { PrismaServiceManagementAdapter } from '../../contexts/commerce/infrastructure/prisma/prisma-service-management.adapter';
import { PrismaServiceReadAdapter } from '../../contexts/commerce/infrastructure/prisma/prisma-service-read.adapter';
import { COMMERCE_SERVICE_MANAGEMENT_PORT } from '../../contexts/commerce/ports/outbound/service-management.port';
import { COMMERCE_SERVICE_READ_PORT } from '../../contexts/commerce/ports/outbound/service-read.port';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';

@Module({
  imports: [TenancyModule],
  controllers: [ServicesController],
  providers: [
    ServicesService,
    PrismaServiceManagementAdapter,
    PrismaServiceReadAdapter,
    {
      provide: COMMERCE_SERVICE_MANAGEMENT_PORT,
      useExisting: PrismaServiceManagementAdapter,
    },
    {
      provide: COMMERCE_SERVICE_READ_PORT,
      useExisting: PrismaServiceReadAdapter,
    },
  ],
  exports: [ServicesService],
})
export class ServicesModule {}
