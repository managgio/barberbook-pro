import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentBrandId, getCurrentLocalId } from '../../tenancy/tenant.context';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    brandId?: string;
    locationId?: string | null;
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue | null;
  }) {
    const brandId = params.brandId || getCurrentBrandId();
    const locationId =
      params.locationId === undefined ? getCurrentLocalId() : params.locationId;

    return this.prisma.auditLog.create({
      data: {
        brandId,
        locationId: locationId ?? null,
        actorUserId: params.actorUserId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        metadata: params.metadata ?? undefined,
      },
    });
  }

  async list(params: {
    brandId?: string;
    action?: string;
    from?: string;
    to?: string;
    localId?: string;
  }) {
    const brandId = params.brandId || getCurrentBrandId();
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

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        actorUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }
}
