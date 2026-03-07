import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, LoyaltyProgram, LoyaltyScope } from '@prisma/client';
import {
  CommerceLoyaltyManagementPort,
  CommerceLoyaltyProgramInput,
  CommerceLoyaltyProgramUpdateInput,
} from '../../../contexts/commerce/ports/outbound/loyalty-management.port';
import {
  COMMERCE_SUBSCRIPTION_POLICY_PORT,
  CommerceSubscriptionPolicyPort,
} from '../../../contexts/commerce/ports/outbound/subscription-policy.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../../contexts/platform/ports/outbound/tenant-context.port';
import {
  LoyaltyProgress,
  buildLoyaltyProgress,
  isNextLoyaltyVisitFree,
} from '../../../contexts/commerce/domain/services/loyalty-progress-policy';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantConfigService } from '../../../tenancy/tenant-config.service';

type LoyaltyProgramWithMeta = LoyaltyProgram & {
  service: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
};

type LoyaltyRewardHistoryItem = {
  appointmentId: string;
  serviceId: string;
  serviceName: string | null;
  startDateTime: string;
  status: AppointmentStatus;
  price: number;
};

@Injectable()
export class PrismaSubscriptionLoyaltyManagementAdapter implements CommerceLoyaltyManagementPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    @Inject(COMMERCE_SUBSCRIPTION_POLICY_PORT)
    private readonly commerceSubscriptionPolicyPort: CommerceSubscriptionPolicyPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  private async isEnabled() {
    const config = await this.tenantConfig.getEffectiveConfig();
    const hidden = config.adminSidebar?.hiddenSections;
    if (!Array.isArray(hidden)) return true;
    return !hidden.includes('loyalty');
  }

  private async assertEnabled() {
    const enabled = await this.isEnabled();
    if (!enabled) {
      throw new BadRequestException('La fidelización no está habilitada en este local.');
    }
  }

  private mapProgram(program: LoyaltyProgramWithMeta) {
    return {
      id: program.id,
      name: program.name,
      description: program.description || null,
      scope: program.scope,
      requiredVisits: program.requiredVisits,
      maxCyclesPerClient: program.maxCyclesPerClient ?? null,
      priority: program.priority,
      isActive: program.isActive,
      serviceId: program.serviceId ?? null,
      serviceName: program.service?.name ?? null,
      categoryId: program.categoryId ?? null,
      categoryName: program.category?.name ?? null,
      createdAt: program.createdAt.toISOString(),
      updatedAt: program.updatedAt.toISOString(),
    };
  }

  private async validateScope(
    dto: CommerceLoyaltyProgramInput | CommerceLoyaltyProgramUpdateInput,
    currentScope?: LoyaltyScope,
  ) {
    const scope = dto.scope === undefined ? currentScope : this.asLoyaltyScope(dto.scope, 'scope');
    if (!scope) return;
    if (scope === LoyaltyScope.service && !dto.serviceId) {
      throw new BadRequestException('Selecciona un servicio para esta tarjeta.');
    }
    if (scope === LoyaltyScope.category && !dto.categoryId) {
      throw new BadRequestException('Selecciona una categoría para esta tarjeta.');
    }
    if (scope === LoyaltyScope.global) {
      if (dto.serviceId) {
        throw new BadRequestException('Una tarjeta global no puede tener servicio asignado.');
      }
      if (dto.categoryId) {
        throw new BadRequestException('Una tarjeta global no puede tener categoría asignada.');
      }
    }
  }

  private async assertServiceExists(serviceId: string) {
    const localId = this.getLocalId();
    const exists = await this.prisma.service.findFirst({
      where: { id: serviceId, localId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Service not found');
  }

  private async assertCategoryExists(categoryId: string) {
    const localId = this.getLocalId();
    const exists = await this.prisma.serviceCategory.findFirst({
      where: { id: categoryId, localId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Category not found');
  }

  async findAllAdmin() {
    await this.assertEnabled();
    const localId = this.getLocalId();
    const programs = await this.prisma.loyaltyProgram.findMany({
      where: { localId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: { service: { select: { id: true, name: true } }, category: { select: { id: true, name: true } } },
    });
    return programs.map((program) => this.mapProgram(program));
  }

  async findActive() {
    if (!(await this.isEnabled())) return [];
    const localId = this.getLocalId();
    const programs = await this.prisma.loyaltyProgram.findMany({
      where: { localId, isActive: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: { service: { select: { id: true, name: true } }, category: { select: { id: true, name: true } } },
    });
    return programs.map((program) => this.mapProgram(program));
  }

  async create(data: CommerceLoyaltyProgramInput) {
    await this.assertEnabled();
    const scope = this.asLoyaltyScope(data.scope, 'scope');
    await this.validateScope(data);
    if (scope === LoyaltyScope.service && data.serviceId) {
      await this.assertServiceExists(data.serviceId);
    }
    if (scope === LoyaltyScope.category && data.categoryId) {
      await this.assertCategoryExists(data.categoryId);
    }
    const localId = this.getLocalId();
    const created = await this.prisma.loyaltyProgram.create({
      data: {
        localId,
        name: data.name,
        description: data.description ?? null,
        scope,
        requiredVisits: data.requiredVisits,
        maxCyclesPerClient: data.maxCyclesPerClient ?? null,
        priority: data.priority ?? 0,
        isActive: data.isActive ?? true,
        serviceId: scope === LoyaltyScope.service ? data.serviceId ?? null : null,
        categoryId: scope === LoyaltyScope.category ? data.categoryId ?? null : null,
      },
      include: { service: { select: { id: true, name: true } }, category: { select: { id: true, name: true } } },
    });
    return this.mapProgram(created);
  }

  async update(id: string, data: CommerceLoyaltyProgramUpdateInput) {
    await this.assertEnabled();
    const localId = this.getLocalId();
    const existing = await this.prisma.loyaltyProgram.findFirst({ where: { id, localId } });
    if (!existing) throw new NotFoundException('Loyalty program not found');
    const scope = data.scope === undefined ? undefined : this.asLoyaltyScope(data.scope, 'scope');
    await this.validateScope({ ...data, scope }, existing.scope);

    const nextScope = scope ?? existing.scope;
    const nextServiceId = nextScope === LoyaltyScope.service ? (data.serviceId ?? existing.serviceId) : null;
    const nextCategoryId = nextScope === LoyaltyScope.category ? (data.categoryId ?? existing.categoryId) : null;
    if (nextScope === LoyaltyScope.service && nextServiceId) {
      await this.assertServiceExists(nextServiceId);
    }
    if (nextScope === LoyaltyScope.category && nextCategoryId) {
      await this.assertCategoryExists(nextCategoryId);
    }

    const updated = await this.prisma.loyaltyProgram.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        description: data.description ?? existing.description,
        scope: scope ?? existing.scope,
        requiredVisits: data.requiredVisits ?? existing.requiredVisits,
        maxCyclesPerClient:
          data.maxCyclesPerClient === undefined ? existing.maxCyclesPerClient : data.maxCyclesPerClient,
        priority: data.priority ?? existing.priority,
        isActive: data.isActive ?? existing.isActive,
        serviceId: nextServiceId,
        categoryId: nextCategoryId,
      },
      include: { service: { select: { id: true, name: true } }, category: { select: { id: true, name: true } } },
    });
    return this.mapProgram(updated);
  }

  async remove(id: string) {
    await this.assertEnabled();
    const localId = this.getLocalId();
    const existing = await this.prisma.loyaltyProgram.findFirst({ where: { id, localId } });
    if (!existing) throw new NotFoundException('Loyalty program not found');
    await this.prisma.loyaltyProgram.delete({ where: { id } });
    return { success: true };
  }

  private async resolveProgramForService(
    serviceId: string,
    userId?: string | null,
  ): Promise<LoyaltyProgramWithMeta | null> {
    if (!(await this.isEnabled())) return null;
    const localId = this.getLocalId();
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, localId },
      select: { id: true, categoryId: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    const programs = await this.prisma.loyaltyProgram.findMany({
      where: {
        localId,
        isActive: true,
        OR: [
          { scope: LoyaltyScope.global },
          { scope: LoyaltyScope.service, serviceId },
          ...(service.categoryId ? [{ scope: LoyaltyScope.category, categoryId: service.categoryId }] : []),
        ],
      },
      include: { service: { select: { id: true, name: true } }, category: { select: { id: true, name: true } } },
    });
    if (programs.length === 0) return null;

    let eligiblePrograms = programs;
    if (userId) {
      const filtered: LoyaltyProgramWithMeta[] = [];
      for (const program of programs) {
        if (program.maxCyclesPerClient && program.maxCyclesPerClient > 0) {
          const rewardsCount = await this.countCompletedRewards(userId, program.id);
          if (rewardsCount >= program.maxCyclesPerClient) {
            continue;
          }
        }
        filtered.push(program);
      }
      eligiblePrograms = filtered;
    }
    if (eligiblePrograms.length === 0) return null;

    const score = (program: LoyaltyProgram) => {
      if (program.scope === LoyaltyScope.service) return 3;
      if (program.scope === LoyaltyScope.category) return 2;
      return 1;
    };

    return eligiblePrograms.sort((a, b) => {
      const scopeDiff = score(b) - score(a);
      if (scopeDiff !== 0) return scopeDiff;
      const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
      if (priorityDiff !== 0) return priorityDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })[0];
  }

  private async countCompletedVisits(userId: string, programId: string) {
    const localId = this.getLocalId();
    return this.prisma.appointment.count({
      where: {
        localId,
        userId,
        loyaltyProgramId: programId,
        status: 'completed',
      },
    });
  }

  private async countCompletedRewards(userId: string, programId: string) {
    const localId = this.getLocalId();
    return this.prisma.appointment.count({
      where: {
        localId,
        userId,
        loyaltyProgramId: programId,
        loyaltyRewardApplied: true,
        status: 'completed',
      },
    });
  }

  private async countActiveVisits(userId: string, programId: string) {
    const localId = this.getLocalId();
    return this.prisma.appointment.count({
      where: {
        localId,
        userId,
        loyaltyProgramId: programId,
        status: { notIn: ['cancelled', 'no_show'] },
      },
    });
  }

  private buildProgress(program: LoyaltyProgram, totalVisitsAccumulated: number): LoyaltyProgress {
    return buildLoyaltyProgress({
      requiredVisits: program.requiredVisits,
      totalVisitsAccumulated,
    });
  }

  private async getRewardHistory(userId: string, programId: string, limit = 8): Promise<LoyaltyRewardHistoryItem[]> {
    const localId = this.getLocalId();
    const rewards = await this.prisma.appointment.findMany({
      where: {
        localId,
        userId,
        loyaltyProgramId: programId,
        loyaltyRewardApplied: true,
        status: 'completed',
      },
      orderBy: { startDateTime: 'desc' },
      take: limit,
      select: {
        id: true,
        serviceId: true,
        serviceNameSnapshot: true,
        startDateTime: true,
        status: true,
        price: true,
        service: { select: { name: true } },
      },
    });

    return rewards.map((reward) => ({
      appointmentId: reward.id,
      serviceId: reward.serviceId,
      serviceName: reward.serviceNameSnapshot ?? reward.service?.name ?? null,
      startDateTime: reward.startDateTime.toISOString(),
      status: reward.status,
      price: Number(reward.price),
    }));
  }

  async getSummary(userId: string) {
    if (!(await this.isEnabled())) {
      return { enabled: false, programs: [] };
    }
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const hasSubscription = await this.commerceSubscriptionPolicyPort.hasUsableActiveSubscription(userId, new Date());
    if (hasSubscription) {
      return { enabled: false, blockedBySubscription: true, programs: [] };
    }
    const localId = this.getLocalId();
    const programs = await this.prisma.loyaltyProgram.findMany({
      where: { localId, isActive: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: { service: { select: { id: true, name: true } }, category: { select: { id: true, name: true } } },
    });
    const progressList = await Promise.all(
      programs.map(async (program) => {
        if (program.maxCyclesPerClient && program.maxCyclesPerClient > 0) {
          const rewardsCount = await this.countCompletedRewards(userId, program.id);
          if (rewardsCount >= program.maxCyclesPerClient) {
            return null;
          }
        }
        const totalVisitsAccumulated = await this.countCompletedVisits(userId, program.id);
        const rewards = await this.getRewardHistory(userId, program.id);
        return {
          program: this.mapProgram(program),
          progress: this.buildProgress(program, totalVisitsAccumulated),
          rewards,
        };
      }),
    );
    const filtered = progressList.filter((item): item is NonNullable<typeof item> => item !== null);
    return { enabled: true, programs: filtered };
  }

  async getPreview(userId: string, serviceId: string) {
    if (!(await this.isEnabled())) {
      return { enabled: false, program: null, progress: null, isFreeNext: false, nextIndex: null };
    }
    if (!userId || !serviceId) {
      throw new BadRequestException('userId and serviceId are required');
    }
    const hasSubscription = await this.commerceSubscriptionPolicyPort.hasUsableActiveSubscription(userId, new Date());
    if (hasSubscription) {
      return {
        enabled: false,
        blockedBySubscription: true,
        program: null,
        progress: null,
        isFreeNext: false,
        nextIndex: null,
      };
    }
    const program = await this.resolveProgramForService(serviceId, userId);
    if (!program) {
      return { enabled: true, program: null, progress: null, isFreeNext: false, nextIndex: null };
    }
    const completedCount = await this.countCompletedVisits(userId, program.id);
    const activeCount = await this.countActiveVisits(userId, program.id);
    const progress = this.buildProgress(program, completedCount);
    const nextIndex = activeCount + 1;
    const isFreeNext = isNextLoyaltyVisitFree({
      requiredVisits: program.requiredVisits,
      totalVisitsAccumulated: completedCount,
      activeVisits: activeCount,
    });
    return {
      enabled: true,
      program: this.mapProgram(program),
      progress,
      isFreeNext,
      nextIndex,
    };
  }

  async resolveRewardDecision(userId: string | null | undefined, serviceId: string) {
    if (!userId) return null;
    if (!(await this.isEnabled())) return null;
    if (await this.commerceSubscriptionPolicyPort.hasUsableActiveSubscription(userId, new Date())) {
      return null;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || user.role !== 'client') return null;
    const program = await this.resolveProgramForService(serviceId, userId);
    if (!program) return null;
    const completedCount = await this.countCompletedVisits(userId, program.id);
    const activeCount = await this.countActiveVisits(userId, program.id);
    const progress = this.buildProgress(program, completedCount);
    const nextIndex = activeCount + 1;
    const isFreeNext = isNextLoyaltyVisitFree({
      requiredVisits: program.requiredVisits,
      totalVisitsAccumulated: completedCount,
      activeVisits: activeCount,
    });
    return { program, progress, isFreeNext, nextIndex };
  }

  private getLocalId() {
    return this.tenantContextPort.getRequestContext().localId;
  }

  private asLoyaltyScope(value: string, field: string): LoyaltyScope {
    if ((Object.values(LoyaltyScope) as string[]).includes(value)) {
      return value as LoyaltyScope;
    }
    throw new BadRequestException(`${field} no es un scope de fidelización válido.`);
  }
}
