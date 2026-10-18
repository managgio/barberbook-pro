import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReviewFeedbackStatus } from '@prisma/client';
import {
  ENGAGEMENT_REVIEW_MANAGEMENT_PORT,
  EngagementReviewActor,
  EngagementReviewConfigPayload,
  EngagementReviewCopyPayload,
  EngagementReviewManagementPort,
  EngagementUpdateReviewConfigInput,
} from '../../../contexts/engagement/ports/outbound/review-management.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../../contexts/platform/ports/outbound/tenant-context.port';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantConfigService } from '../../../tenancy/tenant-config.service';
import { PrismaReviewRequests } from './prisma-review-requests';
import { ReviewAction } from '../../../contexts/engagement/domain/services/review-request-policy';

const buildDateFilter = (from?: Date, to?: Date) => {
  if (!from && !to) return undefined;
  return {
    gte: from,
    lte: to,
  } as const;
};

const DEFAULT_REVIEW_COPY: EngagementReviewCopyPayload = {
  title: '¿Qué tal tu visita hoy?',
  subtitle: 'Tu opinión nos ayuda a mejorar.',
  positiveText: '¿Te importa dejar una reseña? Nos ayuda muchísimo.',
  positiveCta: 'Dejar reseña en Google',
  negativeText: 'Cuéntanos qué te gustaría compartir con el equipo.',
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

const mergeCopy = (
  copy?: Partial<EngagementReviewCopyPayload> | null,
  fallback?: Partial<EngagementReviewCopyPayload> | null,
): EngagementReviewCopyPayload => {
  const source = { ...DEFAULT_REVIEW_COPY, ...(fallback ?? {}), ...(copy ?? {}) } as EngagementReviewCopyPayload;
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
export class PrismaReviewManagementAdapter implements EngagementReviewManagementPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  private getLocalId() {
    return this.tenantContextPort.getRequestContext().localId;
  }

  private requireActor(actor: EngagementReviewActor) {
    const userId = actor.userId?.trim();
    if (!userId) throw new BadRequestException('Se requiere un usuario autenticado.');
    return userId;
  }

  private async activeConfig() {
    if (!(await this.isModuleEnabled())) return null;
    const config = await this.getConfig();
    return config.enabled && config.googleReviewUrl ? config : null;
  }

  private async transition(id: string, actor: EngagementReviewActor, action: ReviewAction) {
    const config = await this.activeConfig();
    if (!config) throw new BadRequestException('El programa de reseñas está desactivado.');
    return new PrismaReviewRequests(this.prisma).transition(this.getLocalId(), this.requireActor(actor), id, action, config);
  }

  async isModuleEnabled() {
    const config = await this.tenantConfig.getEffectiveConfig();
    const hidden = config.adminSidebar?.hiddenSections;
    if (!Array.isArray(hidden)) return true;
    return !hidden.includes('reviews');
  }

  async getConfig(): Promise<EngagementReviewConfigPayload> {
    const localId = this.getLocalId();
    const config = await this.prisma.reviewProgramConfig.findFirst({ where: { localId } });
    const copyJson = mergeCopy(config?.copyJson as Partial<EngagementReviewCopyPayload> | null);
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
    const localId = this.getLocalId();
    return this.prisma.reviewProgramConfig.findFirst({ where: { localId } });
  }

  async updateConfig(data: EngagementUpdateReviewConfigInput): Promise<EngagementReviewConfigPayload> {
    if (!(await this.isModuleEnabled())) {
      throw new BadRequestException('El módulo de reseñas no está habilitado en este local.');
    }

    const localId = this.getLocalId();
    const existing = await this.prisma.reviewProgramConfig.findFirst({ where: { localId } });

    const nextEnabled = data.enabled ?? existing?.enabled ?? DEFAULT_REVIEW_CONFIG.enabled;
    const nextGoogleReviewUrl =
      data.googleReviewUrl !== undefined
        ? data.googleReviewUrl?.trim() || null
        : existing?.googleReviewUrl ?? DEFAULT_REVIEW_CONFIG.googleReviewUrl;

    if (nextEnabled && !nextGoogleReviewUrl) {
      throw new BadRequestException('Debes indicar la URL de reseñas de Google.');
    }

    const nextCopy = mergeCopy(
      data.copyJson ?? null,
      existing?.copyJson as Partial<EngagementReviewCopyPayload> | null,
    );

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
      copyJson: mergeCopy(updated.copyJson as Partial<EngagementReviewCopyPayload> | null),
    };
  }

  async handleAppointmentCompleted(appointmentId: string) {
    const config = await this.activeConfig();
    if (!config) return null;
    return new PrismaReviewRequests(this.prisma).createForAppointment(this.tenantContextPort.getRequestContext(), appointmentId, config);
  }

  async getPendingReview(actor: EngagementReviewActor) {
    const config = await this.activeConfig();
    if (!config) return null;
    const request = await new PrismaReviewRequests(this.prisma).pending(this.getLocalId(), this.requireActor(actor), config);
    return request ? { ...request, copy: config.copyJson, googleReviewUrl: config.googleReviewUrl } : null;
  }

  markShown(id: string, actor: EngagementReviewActor) {
    return this.transition(id, actor, { type: 'shown' });
  }

  async rate(id: string, rating: number, actor: EngagementReviewActor) {
    await this.transition(id, actor, { type: 'rate', rating });
    const config = await this.getConfig();
    return { next: 'GOOGLE' as const, googleReviewUrl: config.googleReviewUrl, ctaText: config.copyJson.positiveCta, message: config.copyJson.positiveText };
  }

  submitFeedback(id: string, text: string, actor: EngagementReviewActor) {
    return this.transition(id, actor, { type: 'feedback', text });
  }

  markClicked(id: string, actor: EngagementReviewActor) {
    return this.transition(id, actor, { type: 'click' });
  }

  snooze(id: string, actor: EngagementReviewActor) {
    return this.transition(id, actor, { type: 'snooze' });
  }

  async getMetrics(params?: { from?: Date; to?: Date }) {
    const localId = this.getLocalId();
    const createdRange = buildDateFilter(params?.from, params?.to);
    const cohort = { localId, ...(createdRange ? { createdAt: createdRange } : {}) };

    const [createdCount, shownCount, ratedCount, googleClicksCount, feedbackCount] = await Promise.all([
      this.prisma.reviewRequest.count({
        where: cohort,
      }),
      this.prisma.reviewRequest.count({
        where: { ...cohort, shownAt: { not: null } },
      }),
      this.prisma.reviewRequest.count({
        where: { ...cohort, ratedAt: { not: null } },
      }),
      this.prisma.reviewRequest.count({
        where: { ...cohort, clickedAt: { not: null } },
      }),
      this.prisma.reviewRequest.count({
        where: {
          ...cohort,
          privateFeedback: { not: null },
        },
      }),
    ]);

    const conversionRate = shownCount > 0 ? Number((googleClicksCount / shownCount).toFixed(4)) : 0;

    return {
      createdCount,
      shownCount,
      ratedCount,
      googleClicksCount,
      feedbackCount,
      conversionRate,
    };
  }

  async listFeedback(params: { status?: string; page: number; pageSize: number }) {
    const localId = this.getLocalId();
    const feedbackStatus = params.status as ReviewFeedbackStatus | undefined;
    const where = {
      localId,
      privateFeedback: { not: null },
      ...(feedbackStatus ? { feedbackStatus } : {}),
    } as const;

    const [total, items] = await Promise.all([
      this.prisma.reviewRequest.count({ where }),
      this.prisma.reviewRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          appointment: {
            select: {
              id: true,
              startDateTime: true,
              service: { select: { name: true } },
              barber: { select: { name: true } },
              user: { select: { name: true, email: true, phone: true } },
              guestName: true,
              guestContact: true,
            },
          },
        },
      }),
    ]);

    const mapped = items.map((item) => ({
      id: item.id,
      rating: item.rating,
      privateFeedback: item.privateFeedback,
      feedbackStatus: item.feedbackStatus,
      status: item.status,
      createdAt: item.createdAt,
      appointmentId: item.appointmentId,
      appointmentDate: item.appointment?.startDateTime ?? null,
      serviceName: item.appointment?.service?.name ?? null,
      barberName: item.appointment?.barber?.name ?? null,
      clientName: item.appointment?.user?.name ?? item.appointment?.guestName ?? null,
      clientEmail: item.appointment?.user?.email ?? null,
      clientPhone: item.appointment?.user?.phone ?? null,
      guestContact: item.appointment?.guestContact ?? null,
    }));

    return { total, items: mapped };
  }

  async resolveFeedback(id: string) {
    const localId = this.getLocalId();
    const request = await this.prisma.reviewRequest.findFirst({ where: { id, localId, privateFeedback: { not: null } }, select: { id: true } });
    if (!request) throw new NotFoundException('Review request not found');
    return this.prisma.reviewRequest.update({
      where: { id: request.id, localId },
      data: { feedbackStatus: ReviewFeedbackStatus.RESOLVED },
    });
  }
}

export const REVIEW_MANAGEMENT_PROVIDER = {
  provide: ENGAGEMENT_REVIEW_MANAGEMENT_PORT,
  useExisting: PrismaReviewManagementAdapter,
};
