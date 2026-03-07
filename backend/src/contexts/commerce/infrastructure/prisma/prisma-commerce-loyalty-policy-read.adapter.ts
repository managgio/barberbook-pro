import { Injectable } from '@nestjs/common';
import { LoyaltyScope } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { TenantConfigService } from '../../../../tenancy/tenant-config.service';
import {
  CommerceLoyaltyPolicyReadPort,
  CommerceLoyaltyProgram,
} from '../../ports/outbound/loyalty-policy-read.port';

@Injectable()
export class PrismaCommerceLoyaltyPolicyReadAdapter implements CommerceLoyaltyPolicyReadPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  async isLoyaltyEnabled(_: { localId: string }): Promise<boolean> {
    const config = await this.tenantConfig.getEffectiveConfig();
    const hidden = config.adminSidebar?.hiddenSections;
    if (!Array.isArray(hidden)) return true;
    return !hidden.includes('loyalty');
  }

  async getUserRole(params: { userId: string }): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
      select: { role: true },
    });
    return user?.role ?? null;
  }

  async getServiceCategory(params: { localId: string; serviceId: string }): Promise<string | null> {
    const service = await this.prisma.service.findFirst({
      where: { id: params.serviceId, localId: params.localId },
      select: { categoryId: true },
    });
    return service?.categoryId ?? null;
  }

  async listActiveProgramsForService(params: {
    localId: string;
    serviceId: string;
    categoryId: string | null;
  }): Promise<CommerceLoyaltyProgram[]> {
    const programs = await this.prisma.loyaltyProgram.findMany({
      where: {
        localId: params.localId,
        isActive: true,
        OR: [
          { scope: LoyaltyScope.global },
          { scope: LoyaltyScope.service, serviceId: params.serviceId },
          ...(params.categoryId ? [{ scope: LoyaltyScope.category, categoryId: params.categoryId }] : []),
        ],
      },
      select: {
        id: true,
        scope: true,
        requiredVisits: true,
        maxCyclesPerClient: true,
        priority: true,
        createdAt: true,
      },
    });

    return programs.map((program) => ({
      id: program.id,
      scope: program.scope,
      requiredVisits: program.requiredVisits,
      maxCyclesPerClient: program.maxCyclesPerClient,
      priority: program.priority,
      createdAt: program.createdAt,
    }));
  }

  countCompletedRewards(params: { localId: string; userId: string; programId: string }): Promise<number> {
    return this.prisma.appointment.count({
      where: {
        localId: params.localId,
        userId: params.userId,
        loyaltyProgramId: params.programId,
        loyaltyRewardApplied: true,
        status: 'completed',
      },
    });
  }

  countCompletedVisits(params: { localId: string; userId: string; programId: string }): Promise<number> {
    return this.prisma.appointment.count({
      where: {
        localId: params.localId,
        userId: params.userId,
        loyaltyProgramId: params.programId,
        status: 'completed',
      },
    });
  }

  countActiveVisits(params: { localId: string; userId: string; programId: string }): Promise<number> {
    return this.prisma.appointment.count({
      where: {
        localId: params.localId,
        userId: params.userId,
        loyaltyProgramId: params.programId,
        status: { notIn: ['cancelled', 'no_show'] },
      },
    });
  }
}
