import {
  PlatformAuditLogCreateInput,
  PlatformAuditLogEntry,
  PlatformAuditLogListInput,
  PlatformAuditLogManagementPort,
} from '../../ports/outbound/platform-audit-log-management.port';

export class ManagePlatformAuditLogsUseCase {
  constructor(private readonly auditLogManagementPort: PlatformAuditLogManagementPort) {}

  log(params: PlatformAuditLogCreateInput): Promise<unknown> {
    return this.auditLogManagementPort.log(params);
  }

  list(params: PlatformAuditLogListInput): Promise<PlatformAuditLogEntry[]> {
    return this.auditLogManagementPort.list(params);
  }
}
