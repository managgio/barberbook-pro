export const PLATFORM_AUDIT_LOG_MANAGEMENT_PORT = Symbol('PLATFORM_AUDIT_LOG_MANAGEMENT_PORT');

export type PlatformAuditLogActor = {
  id: string;
  name: string | null;
  email: string;
};

export type PlatformAuditLogEntry = {
  id: string;
  brandId: string;
  locationId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata?: unknown;
  createdAt: Date;
  actorUser: PlatformAuditLogActor | null;
};

export type PlatformAuditLogCreateInput = {
  brandId?: string;
  locationId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: unknown;
};

export type PlatformAuditLogListInput = {
  brandId?: string;
  action?: string;
  from?: string;
  to?: string;
  localId?: string;
};

export interface PlatformAuditLogManagementPort {
  log(params: PlatformAuditLogCreateInput): Promise<unknown>;
  list(params: PlatformAuditLogListInput): Promise<PlatformAuditLogEntry[]>;
}
