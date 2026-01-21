import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import { AuditLogsService } from './audit-logs.service';

@Controller('platform/brands/:brandId/audit-logs')
@UseGuards(PlatformAdminGuard)
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  listLogs(
    @Param('brandId') brandId: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('localId') localId?: string,
  ) {
    return this.auditLogs.list({ brandId, action, from, to, localId });
  }
}
