import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantService } from './tenant.service';
import { TenantConfigService } from './tenant-config.service';
import { TenantMiddleware } from './tenant.middleware';
import { TenantController } from './tenant.controller';
import { TenantPrismaService } from './tenant-prisma.service';

@Module({
  imports: [PrismaModule],
  providers: [TenantService, TenantConfigService, TenantMiddleware, TenantPrismaService],
  controllers: [TenantController],
  exports: [TenantService, TenantConfigService, TenantMiddleware, TenantPrismaService],
})
export class TenancyModule {}
