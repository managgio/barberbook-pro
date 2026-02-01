import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { UpdateReviewConfigDto, ReviewCopyDto } from './dto/update-review-config.dto';

export type ReviewCopyPayload = Required<ReviewCopyDto>;

export type ReviewConfigPayload = {
  id: string | null;
  localId: string;
  enabled: boolean;
  googleReviewUrl: string | null;
  cooldownDays: number;
  minVisitsToAsk: number;
  showDelayMinutes: number;
  maxSnoozes: number;
  snoozeHours: number;
  copyJson: ReviewCopyPayload;
};

const DEFAULT_REVIEW_COPY: ReviewCopyPayload = {
  title: '¿Qué tal tu visita hoy?',
  subtitle: 'Tu opinión nos ayuda a mejorar.',
  positiveText: '¿Te importa dejar una reseña? Nos ayuda muchísimo.',
  positiveCta: 'Dejar reseña en Google',
  negativeText: 'Lo sentimos. Cuéntanos qué pasó y lo solucionamos.',
  negativeCta: 'Enviar',
  snoozeCta: 'Ahora no',
};

const DEFAULT_REVIEW_CONFIG = {
  enabled: false,
  googleReviewUrl: null as string | null,
  cooldownDays: 60,
  minVisitsToAsk: 2,
  showDelayMinutes: 60,
  maxSnoozes: 1,
  snoozeHours: 48,
  copyJson: DEFAULT_REVIEW_COPY,
};

const toJsonInput = (value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput =>
  value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);

const mergeCopy = (copy?: ReviewCopyDto | null, fallback?: ReviewCopyDto | null): ReviewCopyPayload => {
  const source = { ...DEFAULT_REVIEW_COPY, ...(fallback ?? {}), ...(copy ?? {}) } as ReviewCopyPayload;
  return {
    title: source.title?.trim() || DEFAULT_REVIEW_COPY.title,
    subtitle: source.subtitle?.trim() || DEFAULT_REVIEW_COPY.subtitle,
    positiveText: source.positiveText?.trim() || DEFAULT_REVIEW_COPY.positiveText,
    positiveCta: source.positiveCta?.trim() || DEFAULT_REVIEW_COPY.positiveCta,
    negativeText: source.negativeText?.trim() || DEFAULT_REVIEW_COPY.negativeText,
    negativeCta: source.negativeCta?.trim() || DEFAULT_REVIEW_COPY.negativeCta,
    snoozeCta: source.snoozeCta?.trim() || DEFAULT_REVIEW_COPY.snoozeCta,
  };
};

@Injectable()
export class ReviewConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  async isModuleEnabled() {
    const config = await this.tenantConfig.getEffectiveConfig();
    const hidden = config.adminSidebar?.hiddenSections;
    if (!Array.isArray(hidden)) return true;
    return !hidden.includes('reviews');
  }

  async getConfig(): Promise<ReviewConfigPayload> {
    const localId = getCurrentLocalId();
    const config = await this.prisma.reviewProgramConfig.findFirst({ where: { localId } });
    const copyJson = mergeCopy(config?.copyJson as ReviewCopyDto | null);
    if (!config) {
      return {
        id: null,
        localId,
        enabled: DEFAULT_REVIEW_CONFIG.enabled,
        googleReviewUrl: DEFAULT_REVIEW_CONFIG.googleReviewUrl,
        cooldownDays: DEFAULT_REVIEW_CONFIG.cooldownDays,
        minVisitsToAsk: DEFAULT_REVIEW_CONFIG.minVisitsToAsk,
        showDelayMinutes: DEFAULT_REVIEW_CONFIG.showDelayMinutes,
        maxSnoozes: DEFAULT_REVIEW_CONFIG.maxSnoozes,
        snoozeHours: DEFAULT_REVIEW_CONFIG.snoozeHours,
        copyJson,
      };
    }

    return {
      id: config.id,
      localId: config.localId,
      enabled: config.enabled,
      googleReviewUrl: config.googleReviewUrl,
      cooldownDays: config.cooldownDays,
      minVisitsToAsk: config.minVisitsToAsk,
      showDelayMinutes: config.showDelayMinutes,
      maxSnoozes: config.maxSnoozes,
      snoozeHours: config.snoozeHours,
      copyJson,
    };
  }

  async getConfigRaw() {
    const localId = getCurrentLocalId();
    return this.prisma.reviewProgramConfig.findFirst({ where: { localId } });
  }

  async updateConfig(data: UpdateReviewConfigDto): Promise<ReviewConfigPayload> {
    if (!(await this.isModuleEnabled())) {
      throw new BadRequestException('El módulo de reseñas no está habilitado en este local.');
    }

    const localId = getCurrentLocalId();
    const existing = await this.prisma.reviewProgramConfig.findFirst({ where: { localId } });

    const nextEnabled = data.enabled ?? existing?.enabled ?? DEFAULT_REVIEW_CONFIG.enabled;
    const nextGoogleReviewUrl =
      data.googleReviewUrl !== undefined
        ? data.googleReviewUrl.trim()
        : existing?.googleReviewUrl ?? DEFAULT_REVIEW_CONFIG.googleReviewUrl;

    if (nextEnabled && !nextGoogleReviewUrl) {
      throw new BadRequestException('Debes indicar la URL de reseñas de Google.');
    }

    const nextCopy = mergeCopy(data.copyJson ?? null, existing?.copyJson as ReviewCopyDto | null);

    const nextCooldownDays = data.cooldownDays ?? existing?.cooldownDays ?? DEFAULT_REVIEW_CONFIG.cooldownDays;
    const nextMinVisits = data.minVisitsToAsk ?? existing?.minVisitsToAsk ?? DEFAULT_REVIEW_CONFIG.minVisitsToAsk;
    const nextDelayMinutes = data.showDelayMinutes ?? existing?.showDelayMinutes ?? DEFAULT_REVIEW_CONFIG.showDelayMinutes;
    const nextMaxSnoozes = data.maxSnoozes ?? existing?.maxSnoozes ?? DEFAULT_REVIEW_CONFIG.maxSnoozes;
    const nextSnoozeHours = data.snoozeHours ?? existing?.snoozeHours ?? DEFAULT_REVIEW_CONFIG.snoozeHours;

    if (nextCooldownDays < 1) throw new BadRequestException('El cooldown debe ser de al menos 1 día.');
    if (nextMinVisits < 1) throw new BadRequestException('El mínimo de visitas debe ser de al menos 1.');
    if (nextDelayMinutes < 0) throw new BadRequestException('El retraso no puede ser negativo.');
    if (nextMaxSnoozes < 0) throw new BadRequestException('El número de recordatorios no puede ser negativo.');
    if (nextSnoozeHours < 1) throw new BadRequestException('El tiempo de recordatorio debe ser de al menos 1 hora.');

    const updated = await this.prisma.reviewProgramConfig.upsert({
      where: { localId },
      create: {
        localId,
        enabled: nextEnabled,
        googleReviewUrl: nextGoogleReviewUrl || null,
        cooldownDays: nextCooldownDays,
        minVisitsToAsk: nextMinVisits,
        showDelayMinutes: nextDelayMinutes,
        maxSnoozes: nextMaxSnoozes,
        snoozeHours: nextSnoozeHours,
        copyJson: toJsonInput(nextCopy),
      },
      update: {
        enabled: nextEnabled,
        googleReviewUrl: nextGoogleReviewUrl || null,
        cooldownDays: nextCooldownDays,
        minVisitsToAsk: nextMinVisits,
        showDelayMinutes: nextDelayMinutes,
        maxSnoozes: nextMaxSnoozes,
        snoozeHours: nextSnoozeHours,
        copyJson: toJsonInput(nextCopy),
      },
    });

    return {
      id: updated.id,
      localId: updated.localId,
      enabled: updated.enabled,
      googleReviewUrl: updated.googleReviewUrl,
      cooldownDays: updated.cooldownDays,
      minVisitsToAsk: updated.minVisitsToAsk,
      showDelayMinutes: updated.showDelayMinutes,
      maxSnoozes: updated.maxSnoozes,
      snoozeHours: updated.snoozeHours,
      copyJson: mergeCopy(updated.copyJson as ReviewCopyDto | null),
    };
  }
}
