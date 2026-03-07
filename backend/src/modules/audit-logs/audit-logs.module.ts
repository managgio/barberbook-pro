import { Module } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import { AuthModule } from '../../auth/auth.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import {
  PrismaPlatformAuditLogManagementAdapter,
  PrismaPlatformAuditLogManagementAdapterProvider,
} from './adapters/prisma-platform-audit-log-management.adapter';

@Module({
  imports: [AuthModule, TenancyModule],
  providers: [
    PrismaPlatformAuditLogManagementAdapter,
    PrismaPlatformAuditLogManagementAdapterProvider,
    AuditLogsService,
    PlatformAdminGuard,
  ],
  controllers: [AuditLogsController],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
