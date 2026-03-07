import { Module } from '@nestjs/common';
import { LegalService } from './legal.service';
import { LegalController } from './legal.controller';
import { LegalPlatformController } from './legal-platform.controller';
import { PLATFORM_LEGAL_MANAGEMENT_PORT } from '../../contexts/platform/ports/outbound/platform-legal-management.port';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import { AuthModule } from '../../auth/auth.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import {
  PrismaPlatformLegalManagementAdapter,
  PrismaPlatformLegalManagementAdapterProvider,
} from './adapters/prisma-platform-legal-management.adapter';

@Module({
  imports: [AuditLogsModule, AuthModule, TenancyModule],
  providers: [
    PrismaPlatformLegalManagementAdapter,
    PrismaPlatformLegalManagementAdapterProvider,
    LegalService,
    PlatformAdminGuard,
  ],
  controllers: [LegalController, LegalPlatformController],
  exports: [LegalService, PLATFORM_LEGAL_MANAGEMENT_PORT],
})
export class LegalModule {}
