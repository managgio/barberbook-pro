import { Module } from '@nestjs/common';
import { LegalService } from './legal.service';
import { LegalController } from './legal.controller';
import { LegalPlatformController } from './legal-platform.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';

@Module({
  imports: [AuditLogsModule],
  providers: [LegalService, PlatformAdminGuard],
  controllers: [LegalController, LegalPlatformController],
  exports: [LegalService],
})
export class LegalModule {}
