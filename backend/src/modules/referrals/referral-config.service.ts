import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RewardType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { normalizeAllowedServiceIds, normalizeAntiFraud } from './referral.utils';
import { UpdateReferralConfigDto } from './dto/update-referral-config.dto';

export type ReferralConfigPayload = {
  id: string | null;
  localId: string;
  enabled: boolean;
  attributionExpiryDays: number;
  newCustomerOnly: boolean;
  monthlyMaxRewardsPerReferrer: number | null;
  allowedServiceIds: string[] | null;
  rewardReferrerType: RewardType;
  rewardReferrerValue: number | null;
  rewardReferrerServiceId: string | null;
  rewardReferrerServiceName: string | null;
  rewardReferredType: RewardType;
  rewardReferredValue: number | null;
  rewardReferredServiceId: string | null;
  rewardReferredServiceName: string | null;
  antiFraud: ReturnType<typeof normalizeAntiFraud>;
  appliedTemplateId: string | null;
};

const DEFAULT_REFERRAL_CONFIG = {
  enabled: false,
  attributionExpiryDays: 30,
  newCustomerOnly: true,
  monthlyMaxRewardsPerReferrer: null,
  allowedServiceIds: null as string[] | null,
  rewardReferrerType: RewardType.WALLET,
  rewardReferrerValue: 5,
  rewardReferrerServiceId: null as string | null,
  rewardReferredType: RewardType.WALLET,
  rewardReferredValue: 5,
  rewardReferredServiceId: null as string | null,
  antiFraud: normalizeAntiFraud(undefined),
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toJsonInput = (value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput =>
  value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);

@Injectable()
export class ReferralConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  async isModuleEnabled() {
    const config = await this.tenantConfig.getEffectiveConfig();
    const hidden = config.adminSidebar?.hiddenSections;
    if (!Array.isArray(hidden)) return true;
    return !hidden.includes('referrals');
  }

  private mapConfig(config: any | null, services?: Record<string, string>): ReferralConfigPayload {
    const normalizedServices = services || {};
    if (!config) {
      return {
        id: null,
        localId: getCurrentLocalId(),
        enabled: DEFAULT_REFERRAL_CONFIG.enabled,
        attributionExpiryDays: DEFAULT_REFERRAL_CONFIG.attributionExpiryDays,
        newCustomerOnly: DEFAULT_REFERRAL_CONFIG.newCustomerOnly,
        monthlyMaxRewardsPerReferrer: DEFAULT_REFERRAL_CONFIG.monthlyMaxRewardsPerReferrer,
        allowedServiceIds: DEFAULT_REFERRAL_CONFIG.allowedServiceIds,
        rewardReferrerType: DEFAULT_REFERRAL_CONFIG.rewardReferrerType,
        rewardReferrerValue: DEFAULT_REFERRAL_CONFIG.rewardReferrerValue,
        rewardReferrerServiceId: null,
        rewardReferrerServiceName: null,
        rewardReferredType: DEFAULT_REFERRAL_CONFIG.rewardReferredType,
        rewardReferredValue: DEFAULT_REFERRAL_CONFIG.rewardReferredValue,
        rewardReferredServiceId: null,
        rewardReferredServiceName: null,
        antiFraud: DEFAULT_REFERRAL_CONFIG.antiFraud,
        appliedTemplateId: null,
      };
    }
    const allowedServiceIds = normalizeAllowedServiceIds(config.allowedServiceIds) ?? null;
    return {
      id: config.id,
      localId: config.localId,
      enabled: config.enabled,
      attributionExpiryDays: config.attributionExpiryDays,
      newCustomerOnly: config.newCustomerOnly,
      monthlyMaxRewardsPerReferrer: config.monthlyMaxRewardsPerReferrer ?? null,
      allowedServiceIds,
      rewardReferrerType: config.rewardReferrerType,
      rewardReferrerValue: config.rewardReferrerValue ? Number(config.rewardReferrerValue) : null,
      rewardReferrerServiceId: config.rewardReferrerServiceId ?? null,
      rewardReferrerServiceName: config.rewardReferrerServiceId ? normalizedServices[config.rewardReferrerServiceId] ?? null : null,
      rewardReferredType: config.rewardReferredType,
      rewardReferredValue: config.rewardReferredValue ? Number(config.rewardReferredValue) : null,
      rewardReferredServiceId: config.rewardReferredServiceId ?? null,
      rewardReferredServiceName: config.rewardReferredServiceId ? normalizedServices[config.rewardReferredServiceId] ?? null : null,
      antiFraud: normalizeAntiFraud(config.antiFraud),
      appliedTemplateId: config.appliedTemplateId ?? null,
    };
  }

  async getConfig(): Promise<ReferralConfigPayload> {
    const localId = getCurrentLocalId();
    const config = await this.prisma.referralProgramConfig.findFirst({ where: { localId } });
    const serviceIds = [config?.rewardReferrerServiceId, config?.rewardReferredServiceId].filter(Boolean) as string[];
    const services = serviceIds.length
      ? await this.prisma.service.findMany({ where: { id: { in: serviceIds }, localId }, select: { id: true, name: true } })
      : [];
    const serviceMap = services.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = item.name;
      return acc;
    }, {});
    return this.mapConfig(config, serviceMap);
  }

  async getConfigOrThrow() {
    if (!(await this.isModuleEnabled())) {
      throw new BadRequestException('El programa de referidos no está habilitado en este local.');
    }
    return this.getConfig();
  }

  private async validateReward(
    type: RewardType,
    value: number | null | undefined,
    serviceId: string | null | undefined,
    localId: string,
    fieldPrefix: string,
  ) {
    if (type === RewardType.WALLET || type === RewardType.FIXED_DISCOUNT) {
      if (!value || value <= 0) {
        throw new BadRequestException(`El valor de ${fieldPrefix} debe ser mayor que 0.`);
      }
    }
    if (type === RewardType.PERCENT_DISCOUNT) {
      if (!value || value <= 0 || value > 100) {
        throw new BadRequestException(`El porcentaje de ${fieldPrefix} debe estar entre 1 y 100.`);
      }
    }
    if (type === RewardType.FREE_SERVICE) {
      if (!serviceId) {
        throw new BadRequestException(`Selecciona un servicio para ${fieldPrefix}.`);
      }
      const exists = await this.prisma.service.findFirst({ where: { id: serviceId, localId }, select: { id: true } });
      if (!exists) {
        throw new NotFoundException('Service not found');
      }
    }
  }

  private async validateServiceIds(localId: string, serviceIds: string[] | null) {
    if (!serviceIds || serviceIds.length === 0) return;
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, localId },
      select: { id: true },
    });
    if (services.length !== serviceIds.length) {
      throw new BadRequestException('Uno o varios servicios no existen en este local.');
    }
  }

  private normalizeAllowedServices(input?: string[] | null) {
    if (!input) return null;
    const unique = Array.from(new Set(input.filter((id) => typeof id === 'string' && id.trim().length > 0)));
    return unique.length > 0 ? unique : null;
  }

  async updateConfig(data: UpdateReferralConfigDto) {
    if (!(await this.isModuleEnabled())) {
      throw new BadRequestException('El programa de referidos no está habilitado en este local.');
    }
    const localId = getCurrentLocalId();
    const existing = await this.prisma.referralProgramConfig.findFirst({ where: { localId } });

    const next = {
      enabled: data.enabled ?? existing?.enabled ?? DEFAULT_REFERRAL_CONFIG.enabled,
      attributionExpiryDays: data.attributionExpiryDays ?? existing?.attributionExpiryDays ?? DEFAULT_REFERRAL_CONFIG.attributionExpiryDays,
      newCustomerOnly: data.newCustomerOnly ?? existing?.newCustomerOnly ?? DEFAULT_REFERRAL_CONFIG.newCustomerOnly,
      monthlyMaxRewardsPerReferrer: data.monthlyMaxRewardsPerReferrer === undefined
        ? existing?.monthlyMaxRewardsPerReferrer ?? DEFAULT_REFERRAL_CONFIG.monthlyMaxRewardsPerReferrer
        : data.monthlyMaxRewardsPerReferrer,
      allowedServiceIds: data.allowedServiceIds === undefined
        ? normalizeAllowedServiceIds(existing?.allowedServiceIds) ?? DEFAULT_REFERRAL_CONFIG.allowedServiceIds
        : this.normalizeAllowedServices(data.allowedServiceIds ?? null),
      rewardReferrerType: data.rewardReferrerType ?? existing?.rewardReferrerType ?? DEFAULT_REFERRAL_CONFIG.rewardReferrerType,
      rewardReferrerValue: data.rewardReferrerValue === undefined
        ? toNumberOrNull(existing?.rewardReferrerValue) ?? DEFAULT_REFERRAL_CONFIG.rewardReferrerValue
        : data.rewardReferrerValue,
      rewardReferrerServiceId: data.rewardReferrerServiceId === undefined
        ? existing?.rewardReferrerServiceId ?? DEFAULT_REFERRAL_CONFIG.rewardReferrerServiceId
        : data.rewardReferrerServiceId,
      rewardReferredType: data.rewardReferredType ?? existing?.rewardReferredType ?? DEFAULT_REFERRAL_CONFIG.rewardReferredType,
      rewardReferredValue: data.rewardReferredValue === undefined
        ? toNumberOrNull(existing?.rewardReferredValue) ?? DEFAULT_REFERRAL_CONFIG.rewardReferredValue
        : data.rewardReferredValue,
      rewardReferredServiceId: data.rewardReferredServiceId === undefined
        ? existing?.rewardReferredServiceId ?? DEFAULT_REFERRAL_CONFIG.rewardReferredServiceId
        : data.rewardReferredServiceId,
      antiFraud: normalizeAntiFraud(data.antiFraud ?? existing?.antiFraud),
      appliedTemplateId: existing?.appliedTemplateId ?? null,
    };

    await this.validateReward(next.rewardReferrerType, next.rewardReferrerValue, next.rewardReferrerServiceId, localId, 'la recompensa del embajador');
    await this.validateReward(next.rewardReferredType, next.rewardReferredValue, next.rewardReferredServiceId, localId, 'la recompensa del invitado');
    await this.validateServiceIds(localId, next.allowedServiceIds);

    const updated = await this.prisma.referralProgramConfig.upsert({
      where: { localId },
      create: {
        localId,
        enabled: next.enabled,
        attributionExpiryDays: next.attributionExpiryDays,
        newCustomerOnly: next.newCustomerOnly,
        monthlyMaxRewardsPerReferrer: next.monthlyMaxRewardsPerReferrer,
        allowedServiceIds: toJsonInput(next.allowedServiceIds),
        rewardReferrerType: next.rewardReferrerType,
        rewardReferrerValue: next.rewardReferrerValue,
        rewardReferrerServiceId: next.rewardReferrerServiceId,
        rewardReferredType: next.rewardReferredType,
        rewardReferredValue: next.rewardReferredValue,
        rewardReferredServiceId: next.rewardReferredServiceId,
        antiFraud: next.antiFraud,
        appliedTemplateId: next.appliedTemplateId,
      },
      update: {
        enabled: next.enabled,
        attributionExpiryDays: next.attributionExpiryDays,
        newCustomerOnly: next.newCustomerOnly,
        monthlyMaxRewardsPerReferrer: next.monthlyMaxRewardsPerReferrer,
        allowedServiceIds: toJsonInput(next.allowedServiceIds),
        rewardReferrerType: next.rewardReferrerType,
        rewardReferrerValue: next.rewardReferrerValue,
        rewardReferrerServiceId: next.rewardReferrerServiceId,
        rewardReferredType: next.rewardReferredType,
        rewardReferredValue: next.rewardReferredValue,
        rewardReferredServiceId: next.rewardReferredServiceId,
        antiFraud: next.antiFraud,
      },
    });

    const serviceIds = [updated.rewardReferrerServiceId, updated.rewardReferredServiceId].filter(Boolean) as string[];
    const services = serviceIds.length
      ? await this.prisma.service.findMany({ where: { id: { in: serviceIds }, localId }, select: { id: true, name: true } })
      : [];
    const serviceMap = services.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = item.name;
      return acc;
    }, {});

    return this.mapConfig(updated, serviceMap);
  }

  async applyTemplate(templateId: string) {
    const localId = getCurrentLocalId();
    const location = await this.prisma.location.findFirst({ where: { id: localId }, select: { brandId: true } });
    if (!location) throw new NotFoundException('Location not found');
    const template = await this.prisma.referralConfigTemplate.findFirst({ where: { id: templateId, brandId: location.brandId } });
    if (!template) throw new NotFoundException('Template not found');

    const allowedIds = normalizeAllowedServiceIds(template.allowedServiceIds);
    await this.validateServiceIds(localId, allowedIds);
    if (template.rewardReferrerServiceId) {
      await this.validateServiceIds(localId, [template.rewardReferrerServiceId]);
    }
    if (template.rewardReferredServiceId) {
      await this.validateServiceIds(localId, [template.rewardReferredServiceId]);
    }

    const updated = await this.prisma.referralProgramConfig.upsert({
      where: { localId },
      create: {
        localId,
        enabled: template.enabled,
        attributionExpiryDays: template.attributionExpiryDays,
        newCustomerOnly: template.newCustomerOnly,
        monthlyMaxRewardsPerReferrer: template.monthlyMaxRewardsPerReferrer,
        allowedServiceIds: toJsonInput(allowedIds),
        rewardReferrerType: template.rewardReferrerType,
        rewardReferrerValue: template.rewardReferrerValue,
        rewardReferrerServiceId: template.rewardReferrerServiceId,
        rewardReferredType: template.rewardReferredType,
        rewardReferredValue: template.rewardReferredValue,
        rewardReferredServiceId: template.rewardReferredServiceId,
        antiFraud: normalizeAntiFraud(template.antiFraud),
        appliedTemplateId: template.id,
      },
      update: {
        enabled: template.enabled,
        attributionExpiryDays: template.attributionExpiryDays,
        newCustomerOnly: template.newCustomerOnly,
        monthlyMaxRewardsPerReferrer: template.monthlyMaxRewardsPerReferrer,
        allowedServiceIds: toJsonInput(allowedIds),
        rewardReferrerType: template.rewardReferrerType,
        rewardReferrerValue: template.rewardReferrerValue,
        rewardReferrerServiceId: template.rewardReferrerServiceId,
        rewardReferredType: template.rewardReferredType,
        rewardReferredValue: template.rewardReferredValue,
        rewardReferredServiceId: template.rewardReferredServiceId,
        antiFraud: normalizeAntiFraud(template.antiFraud),
        appliedTemplateId: template.id,
      },
    });

    return this.mapConfig(updated);
  }

  async copyFromLocation(sourceLocationId: string) {
    const localId = getCurrentLocalId();
    if (sourceLocationId === localId) {
      throw new BadRequestException('Selecciona un local diferente.');
    }
    const [target, source] = await Promise.all([
      this.prisma.location.findFirst({ where: { id: localId }, select: { brandId: true } }),
      this.prisma.location.findFirst({ where: { id: sourceLocationId }, select: { brandId: true } }),
    ]);
    if (!target || !source) throw new NotFoundException('Location not found');
    if (target.brandId !== source.brandId) {
      throw new BadRequestException('El local origen debe pertenecer a la misma marca.');
    }
    const sourceConfig = await this.prisma.referralProgramConfig.findFirst({ where: { localId: sourceLocationId } });
    if (!sourceConfig) throw new NotFoundException('El local origen no tiene configuración de referidos.');

    const allowedIds = normalizeAllowedServiceIds(sourceConfig.allowedServiceIds);
    await this.validateServiceIds(localId, allowedIds);
    if (sourceConfig.rewardReferrerServiceId) {
      await this.validateServiceIds(localId, [sourceConfig.rewardReferrerServiceId]);
    }
    if (sourceConfig.rewardReferredServiceId) {
      await this.validateServiceIds(localId, [sourceConfig.rewardReferredServiceId]);
    }

    const updated = await this.prisma.referralProgramConfig.upsert({
      where: { localId },
      create: {
        localId,
        enabled: sourceConfig.enabled,
        attributionExpiryDays: sourceConfig.attributionExpiryDays,
        newCustomerOnly: sourceConfig.newCustomerOnly,
        monthlyMaxRewardsPerReferrer: sourceConfig.monthlyMaxRewardsPerReferrer,
        allowedServiceIds: toJsonInput(allowedIds),
        rewardReferrerType: sourceConfig.rewardReferrerType,
        rewardReferrerValue: sourceConfig.rewardReferrerValue,
        rewardReferrerServiceId: sourceConfig.rewardReferrerServiceId,
        rewardReferredType: sourceConfig.rewardReferredType,
        rewardReferredValue: sourceConfig.rewardReferredValue,
        rewardReferredServiceId: sourceConfig.rewardReferredServiceId,
        antiFraud: normalizeAntiFraud(sourceConfig.antiFraud),
        appliedTemplateId: sourceConfig.appliedTemplateId,
      },
      update: {
        enabled: sourceConfig.enabled,
        attributionExpiryDays: sourceConfig.attributionExpiryDays,
        newCustomerOnly: sourceConfig.newCustomerOnly,
        monthlyMaxRewardsPerReferrer: sourceConfig.monthlyMaxRewardsPerReferrer,
        allowedServiceIds: toJsonInput(allowedIds),
        rewardReferrerType: sourceConfig.rewardReferrerType,
        rewardReferrerValue: sourceConfig.rewardReferrerValue,
        rewardReferrerServiceId: sourceConfig.rewardReferrerServiceId,
        rewardReferredType: sourceConfig.rewardReferredType,
        rewardReferredValue: sourceConfig.rewardReferredValue,
        rewardReferredServiceId: sourceConfig.rewardReferredServiceId,
        antiFraud: normalizeAntiFraud(sourceConfig.antiFraud),
        appliedTemplateId: sourceConfig.appliedTemplateId,
      },
    });

    return this.mapConfig(updated);
  }
}
