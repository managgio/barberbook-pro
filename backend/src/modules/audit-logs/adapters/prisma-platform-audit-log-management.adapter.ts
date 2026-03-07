import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  PLATFORM_AUDIT_LOG_MANAGEMENT_PORT,
  PlatformAuditLogEntry,
  PlatformAuditLogManagementPort,
} from '../../../contexts/platform/ports/outbound/platform-audit-log-management.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../../contexts/platform/ports/outbound/tenant-context.port';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PrismaPlatformAuditLogManagementAdapter implements PlatformAuditLogManagementPort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  private getBrandId() {
    return this.tenantContextPort.getRequestContext().brandId;
  }

  private getLocalId() {
    return this.tenantContextPort.getRequestContext().localId;
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
    const brandId = params.brandId || this.getBrandId();
    const locationId = params.locationId === undefined ? this.getLocalId() : params.locationId;

    return this.prisma.auditLog.create({
      data: {
        brandId,
        locationId: locationId ?? null,
        actorUserId: params.actorUserId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async list(params: {
    brandId?: string;
    action?: string;
    from?: string;
    to?: string;
    localId?: string;
  }): Promise<PlatformAuditLogEntry[]> {
    const brandId = params.brandId || this.getBrandId();
    const where: Record<string, any> = { brandId };
    if (params.localId) {
      where.locationId = params.localId;
    }
    if (params.action) {
      where.action = params.action;
    }
    const fromDate = params.from ? new Date(params.from) : null;
    const toDate = params.to ? new Date(params.to) : null;
    const hasFrom = Boolean(fromDate && !Number.isNaN(fromDate.getTime()));
    const hasTo = Boolean(toDate && !Number.isNaN(toDate.getTime()));
    if (hasFrom || hasTo) {
      where.createdAt = {
        ...(hasFrom ? { gte: fromDate } : {}),
        ...(hasTo ? { lte: toDate } : {}),
      };
    }

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        actorUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      brandId: row.brandId,
      locationId: row.locationId,
      actorUserId: row.actorUserId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: row.metadata,
      createdAt: row.createdAt,
      actorUser: row.actorUser
        ? {
            id: row.actorUser.id,
            name: row.actorUser.name,
            email: row.actorUser.email,
          }
        : null,
    }));
  }
}

export const PrismaPlatformAuditLogManagementAdapterProvider = {
  provide: PLATFORM_AUDIT_LOG_MANAGEMENT_PORT,
  useExisting: PrismaPlatformAuditLogManagementAdapter,
};
