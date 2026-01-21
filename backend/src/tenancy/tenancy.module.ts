import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantService } from './tenant.service';
import { TenantConfigService } from './tenant-config.service';
import { TenantMiddleware } from './tenant.middleware';
import { TenantController } from './tenant.controller';

@Module({
  imports: [PrismaModule],
  providers: [TenantService, TenantConfigService, TenantMiddleware],
  controllers: [TenantController],
  exports: [TenantService, TenantConfigService, TenantMiddleware],
})
export class TenancyModule {}
