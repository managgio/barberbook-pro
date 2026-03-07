import { Inject, Injectable } from '@nestjs/common';
import { ManagePlatformAuditLogsUseCase } from '../../contexts/platform/application/use-cases/manage-platform-audit-logs.use-case';
import {
  PLATFORM_AUDIT_LOG_MANAGEMENT_PORT,
  PlatformAuditLogManagementPort,
} from '../../contexts/platform/ports/outbound/platform-audit-log-management.port';

@Injectable()
export class AuditLogsService {
  private readonly managePlatformAuditLogsUseCase: ManagePlatformAuditLogsUseCase;

  constructor(
    @Inject(PLATFORM_AUDIT_LOG_MANAGEMENT_PORT)
    private readonly auditLogManagementPort: PlatformAuditLogManagementPort,
  ) {
    this.managePlatformAuditLogsUseCase = new ManagePlatformAuditLogsUseCase(this.auditLogManagementPort);
  }

  async log(params: {
    brandId?: string;
    locationId?: string | null;
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: unknown;
  }) {
    return this.managePlatformAuditLogsUseCase.log(params);
  }

  async list(params: {
    brandId?: string;
    action?: string;
    from?: string;
    to?: string;
    localId?: string;
  }) {
    return this.managePlatformAuditLogsUseCase.list(params);
  }
}
