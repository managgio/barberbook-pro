import { Module } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';

@Module({
  providers: [AuditLogsService, PlatformAdminGuard],
  controllers: [AuditLogsController],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
