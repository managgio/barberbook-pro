import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RewardType } from '@prisma/client';
import {
  EngagementCreateReferralTemplateInput,
  EngagementReferralTemplateManagementPort,
  EngagementReferralTemplatePayload,
  EngagementUpdateReferralTemplateInput,
} from '../../../contexts/engagement/ports/outbound/referral-template-management.port';
import { PrismaService } from '../../../prisma/prisma.service';
import { normalizeAllowedServiceIds, normalizeAntiFraud } from '../referral.utils';

@Injectable()
export class PrismaReferralTemplateManagementAdapter implements EngagementReferralTemplateManagementPort {
  constructor(private readonly prisma: PrismaService) {}

  private toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private toJsonInput(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    return value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
  }

  private normalizeTemplate(template: {
    id: string;
    brandId: string;
    name: string;
    enabled: boolean;
    attributionExpiryDays: number;
    newCustomerOnly: boolean;
    monthlyMaxRewardsPerReferrer: Prisma.Decimal | number | null;
    allowedServiceIds: unknown;
    rewardReferrerType: RewardType;
    rewardReferrerValue: Prisma.Decimal | number | null;
    rewardReferrerServiceId: string | null;
    rewardReferredType: RewardType;
    rewardReferredValue: Prisma.Decimal | number | null;
    rewardReferredServiceId: string | null;
    antiFraud: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): EngagementReferralTemplatePayload {
    return {
      ...template,
      monthlyMaxRewardsPerReferrer: this.toNumberOrNull(template.monthlyMaxRewardsPerReferrer),
      rewardReferrerValue: this.toNumberOrNull(template.rewardReferrerValue),
      rewardReferredValue: this.toNumberOrNull(template.rewardReferredValue),
      allowedServiceIds: normalizeAllowedServiceIds(template.allowedServiceIds) ?? null,
      antiFraud: normalizeAntiFraud(template.antiFraud),
    };
  }

  private async validateReward(type: RewardType, value?: number | null, serviceId?: string | null) {
    if (type === RewardType.WALLET || type === RewardType.FIXED_DISCOUNT) {
      if (!value || value <= 0) {
        throw new BadRequestException('El valor de la recompensa debe ser mayor que 0.');
      }
    }
    if (type === RewardType.PERCENT_DISCOUNT) {
      if (!value || value <= 0 || value > 100) {
        throw new BadRequestException('El porcentaje de la recompensa debe estar entre 1 y 100.');
      }
    }
    if (type === RewardType.FREE_SERVICE && !serviceId) {
      throw new BadRequestException('Selecciona un servicio para la recompensa gratuita.');
    }
  }

  async list(brandId: string) {
    const templates = await this.prisma.referralConfigTemplate.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
    });
    return templates.map((template) => this.normalizeTemplate(template));
  }

  async listForLocal(localId: string) {
    const location = await this.prisma.location.findFirst({ where: { id: localId }, select: { brandId: true } });
    if (!location) throw new NotFoundException('Location not found');
    return this.list(location.brandId);
  }

  async create(brandId: string, data: EngagementCreateReferralTemplateInput) {
    await this.validateReward(
      data.rewardReferrerType,
      data.rewardReferrerValue ?? null,
      data.rewardReferrerServiceId ?? null,
    );
    await this.validateReward(
      data.rewardReferredType,
      data.rewardReferredValue ?? null,
      data.rewardReferredServiceId ?? null,
    );

    const created = await this.prisma.referralConfigTemplate.create({
      data: {
        brandId,
        name: data.name,
        enabled: data.enabled ?? true,
        attributionExpiryDays: data.attributionExpiryDays ?? 30,
        newCustomerOnly: data.newCustomerOnly ?? true,
        monthlyMaxRewardsPerReferrer: data.monthlyMaxRewardsPerReferrer ?? null,
        allowedServiceIds: this.toJsonInput(normalizeAllowedServiceIds(data.allowedServiceIds ?? null)),
        rewardReferrerType: data.rewardReferrerType,
        rewardReferrerValue: data.rewardReferrerValue ?? null,
        rewardReferrerServiceId: data.rewardReferrerServiceId ?? null,
        rewardReferredType: data.rewardReferredType,
        rewardReferredValue: data.rewardReferredValue ?? null,
        rewardReferredServiceId: data.rewardReferredServiceId ?? null,
        antiFraud: normalizeAntiFraud(data.antiFraud),
      },
    });

    return this.normalizeTemplate(created);
  }

  async update(id: string, data: EngagementUpdateReferralTemplateInput) {
    const existing = await this.prisma.referralConfigTemplate.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Template not found');

    const nextRewardReferrerType = data.rewardReferrerType ?? existing.rewardReferrerType;
    const nextRewardReferrerValue =
      data.rewardReferrerValue === undefined ? this.toNumberOrNull(existing.rewardReferrerValue) : data.rewardReferrerValue;
    const nextRewardReferrerServiceId =
      data.rewardReferrerServiceId === undefined ? existing.rewardReferrerServiceId : data.rewardReferrerServiceId;
    const nextRewardReferredType = data.rewardReferredType ?? existing.rewardReferredType;
    const nextRewardReferredValue =
      data.rewardReferredValue === undefined ? this.toNumberOrNull(existing.rewardReferredValue) : data.rewardReferredValue;
    const nextRewardReferredServiceId =
      data.rewardReferredServiceId === undefined ? existing.rewardReferredServiceId : data.rewardReferredServiceId;

    await this.validateReward(
      nextRewardReferrerType,
      nextRewardReferrerValue ?? null,
      nextRewardReferrerServiceId ?? null,
    );
    await this.validateReward(
      nextRewardReferredType,
      nextRewardReferredValue ?? null,
      nextRewardReferredServiceId ?? null,
    );

    const updated = await this.prisma.referralConfigTemplate.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        enabled: data.enabled ?? existing.enabled,
        attributionExpiryDays: data.attributionExpiryDays ?? existing.attributionExpiryDays,
        newCustomerOnly: data.newCustomerOnly ?? existing.newCustomerOnly,
        monthlyMaxRewardsPerReferrer:
          data.monthlyMaxRewardsPerReferrer === undefined
            ? existing.monthlyMaxRewardsPerReferrer
            : data.monthlyMaxRewardsPerReferrer,
        allowedServiceIds:
          data.allowedServiceIds === undefined
            ? this.toJsonInput(existing.allowedServiceIds ?? null)
            : this.toJsonInput(normalizeAllowedServiceIds(data.allowedServiceIds ?? null)),
        rewardReferrerType: nextRewardReferrerType,
        rewardReferrerValue: nextRewardReferrerValue ?? null,
        rewardReferrerServiceId: nextRewardReferrerServiceId ?? null,
        rewardReferredType: nextRewardReferredType,
        rewardReferredValue: nextRewardReferredValue ?? null,
        rewardReferredServiceId: nextRewardReferredServiceId ?? null,
        antiFraud: data.antiFraud ? normalizeAntiFraud(data.antiFraud) : normalizeAntiFraud(existing.antiFraud),
      },
    });

    return this.normalizeTemplate(updated);
  }

  async remove(id: string) {
    const existing = await this.prisma.referralConfigTemplate.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Template not found');
    await this.prisma.referralConfigTemplate.delete({ where: { id } });
    return { success: true };
  }
}
