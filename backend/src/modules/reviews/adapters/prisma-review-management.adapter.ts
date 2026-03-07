import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Prisma, ReviewFeedbackStatus, ReviewRequestStatus } from '@prisma/client';
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

const isEmail = (value: string) => value.includes('@');

const parseGuestContact = (guestContact?: string | null) => {
  if (!guestContact) return { guestEmail: null, guestPhone: null };
  const trimmed = guestContact.trim();
  if (!trimmed) return { guestEmail: null, guestPhone: null };
  return isEmail(trimmed)
    ? { guestEmail: trimmed, guestPhone: null }
    : { guestEmail: null, guestPhone: trimmed };
};

const isFinalStatus = (status: ReviewRequestStatus) =>
  status === ReviewRequestStatus.COMPLETED ||
  status === ReviewRequestStatus.CLICKED ||
  status === ReviewRequestStatus.EXPIRED;

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
    const guestEmail = actor.guestEmail?.trim();
    const guestPhone = actor.guestPhone?.trim();
    if (!userId && !guestEmail && !guestPhone) {
      throw new BadRequestException('userId o contacto del invitado es requerido.');
    }
    return { userId: userId || null, guestEmail: guestEmail || null, guestPhone: guestPhone || null };
  }

  private buildActorWhere(actor: { userId: string | null; guestEmail: string | null; guestPhone: string | null }) {
    if (actor.userId) return { userId: actor.userId };
    if (actor.guestEmail) return { guestEmail: actor.guestEmail };
    if (actor.guestPhone) return { guestPhone: actor.guestPhone };
    return {};
  }

  private async getRequestOrThrow(id: string, actor: EngagementReviewActor) {
    const localId = this.getLocalId();
    const actorInfo = this.requireActor(actor);
    const request = await this.prisma.reviewRequest.findFirst({
      where: { id, localId, ...this.buildActorWhere(actorInfo) },
    });
    if (!request) throw new NotFoundException('Review request not found');
    return request;
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
    const localId = this.getLocalId();
    const config = await this.getConfig();
    if (!config.enabled || !config.googleReviewUrl) return null;

    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, localId },
      select: { id: true, userId: true, guestContact: true, status: true, startDateTime: true },
    });
    if (!appointment || appointment.status !== AppointmentStatus.completed) return null;

    const existing = await this.prisma.reviewRequest.findFirst({ where: { appointmentId } });
    if (existing) return existing;

    const contact = parseGuestContact(appointment.guestContact);
    const hasActor = Boolean(appointment.userId || contact.guestEmail || contact.guestPhone);
    if (!hasActor) return null;

    const completedCount = appointment.userId
      ? await this.prisma.appointment.count({
          where: { localId, userId: appointment.userId, status: AppointmentStatus.completed },
        })
      : await this.prisma.appointment.count({
          where: {
            localId,
            status: AppointmentStatus.completed,
            guestContact: appointment.guestContact ?? undefined,
          },
        });

    if (completedCount < config.minVisitsToAsk) return null;

    const cutoff = new Date(Date.now() - config.cooldownDays * 24 * 60 * 60 * 1000);
    const recent = await this.prisma.reviewRequest.findFirst({
      where: {
        localId,
        createdAt: { gte: cutoff },
        ...(appointment.userId
          ? { userId: appointment.userId }
          : contact.guestEmail
          ? { guestEmail: contact.guestEmail }
          : { guestPhone: contact.guestPhone ?? undefined }),
      },
      select: { id: true },
    });

    if (recent) return null;

    const eligibleAt = new Date(Date.now() + config.showDelayMinutes * 60 * 1000);

    return this.prisma.reviewRequest.create({
      data: {
        localId,
        appointmentId: appointment.id,
        userId: appointment.userId ?? null,
        guestEmail: contact.guestEmail,
        guestPhone: contact.guestPhone,
        status: ReviewRequestStatus.PENDING,
        eligibleAt,
      },
    });
  }

  async getPendingReview(actor: EngagementReviewActor) {
    const localId = this.getLocalId();
    const config = await this.getConfig();
    if (!config.enabled || !config.googleReviewUrl) return null;

    const actorInfo = this.requireActor(actor);
    const now = new Date();

    const request = await this.prisma.reviewRequest.findFirst({
      where: {
        localId,
        eligibleAt: { lte: now },
        status: { in: [ReviewRequestStatus.PENDING, ReviewRequestStatus.ELIGIBLE, ReviewRequestStatus.DISMISSED] },
        ...this.buildActorWhere(actorInfo),
      },
      orderBy: { eligibleAt: 'asc' },
    });

    if (!request) return null;

    if (request.status === ReviewRequestStatus.DISMISSED && request.snoozeCount >= config.maxSnoozes) {
      await this.prisma.reviewRequest.update({
        where: { id: request.id },
        data: { status: ReviewRequestStatus.EXPIRED, completedAt: new Date() },
      });
      return null;
    }

    const shouldPromote = request.status === ReviewRequestStatus.PENDING;
    if (shouldPromote) {
      await this.prisma.reviewRequest.update({
        where: { id: request.id },
        data: { status: ReviewRequestStatus.ELIGIBLE },
      });
    }

    return {
      id: request.id,
      status: shouldPromote ? ReviewRequestStatus.ELIGIBLE : request.status,
      rating: request.rating,
      eligibleAt: request.eligibleAt,
      snoozeCount: request.snoozeCount,
      copy: config.copyJson,
      googleReviewUrl: config.googleReviewUrl,
    };
  }

  async markShown(id: string, actor: EngagementReviewActor) {
    const request = await this.getRequestOrThrow(id, actor);
    if (request.shownAt) return request;
    if (isFinalStatus(request.status)) {
      return request;
    }
    return this.prisma.reviewRequest.update({
      where: { id: request.id },
      data: { status: ReviewRequestStatus.SHOWN, shownAt: new Date() },
    });
  }

  async rate(id: string, rating: number, actor: EngagementReviewActor) {
    const request = await this.getRequestOrThrow(id, actor);
    if (isFinalStatus(request.status)) {
      throw new BadRequestException('La solicitud ya está finalizada.');
    }

    await this.prisma.reviewRequest.update({
      where: { id: request.id },
      data: {
        rating,
        ratedAt: new Date(),
        status: ReviewRequestStatus.RATED,
      },
    });

    const config = await this.getConfig();
    if (rating >= 4) {
      return {
        next: 'GOOGLE',
        googleReviewUrl: config.googleReviewUrl,
        ctaText: config.copyJson.positiveCta,
        message: config.copyJson.positiveText,
      };
    }
    return {
      next: 'FEEDBACK',
      ctaText: config.copyJson.negativeCta,
      message: config.copyJson.negativeText,
    };
  }

  async submitFeedback(id: string, text: string, actor: EngagementReviewActor) {
    const request = await this.getRequestOrThrow(id, actor);
    if (!request.rating || request.rating > 3) {
      throw new BadRequestException('La valoración no es elegible para feedback.');
    }
    if (isFinalStatus(request.status)) {
      throw new BadRequestException('La solicitud ya está finalizada.');
    }

    return this.prisma.reviewRequest.update({
      where: { id: request.id },
      data: {
        privateFeedback: text.trim(),
        feedbackStatus: ReviewFeedbackStatus.OPEN,
        status: ReviewRequestStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }

  async markClicked(id: string, actor: EngagementReviewActor) {
    const request = await this.getRequestOrThrow(id, actor);
    if (isFinalStatus(request.status)) {
      return request;
    }
    return this.prisma.reviewRequest.update({
      where: { id: request.id },
      data: {
        status: ReviewRequestStatus.CLICKED,
        clickedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }

  async snooze(id: string, actor: EngagementReviewActor) {
    const request = await this.getRequestOrThrow(id, actor);
    if (isFinalStatus(request.status)) {
      return request;
    }

    const config = await this.getConfig();
    if (config.maxSnoozes <= 0) {
      return this.prisma.reviewRequest.update({
        where: { id: request.id },
        data: { status: ReviewRequestStatus.EXPIRED, completedAt: new Date() },
      });
    }

    const nextCount = request.snoozeCount + 1;
    if (nextCount > config.maxSnoozes) {
      return this.prisma.reviewRequest.update({
        where: { id: request.id },
        data: { snoozeCount: nextCount, status: ReviewRequestStatus.EXPIRED, completedAt: new Date() },
      });
    }

    const eligibleAt = new Date(Date.now() + config.snoozeHours * 60 * 60 * 1000);
    return this.prisma.reviewRequest.update({
      where: { id: request.id },
      data: {
        snoozeCount: nextCount,
        status: ReviewRequestStatus.DISMISSED,
        eligibleAt,
      },
    });
  }

  async getMetrics(params?: { from?: Date; to?: Date }) {
    const localId = this.getLocalId();
    const createdRange = buildDateFilter(params?.from, params?.to);

    const [createdCount, shownCount, ratedCount, googleClicksCount, feedbackCount] = await Promise.all([
      this.prisma.reviewRequest.count({
        where: { localId, ...(createdRange ? { createdAt: createdRange } : {}) },
      }),
      this.prisma.reviewRequest.count({
        where: { localId, ...(createdRange ? { shownAt: createdRange } : { shownAt: { not: null } }) },
      }),
      this.prisma.reviewRequest.count({
        where: { localId, ...(createdRange ? { ratedAt: createdRange } : { ratedAt: { not: null } }) },
      }),
      this.prisma.reviewRequest.count({
        where: { localId, ...(createdRange ? { clickedAt: createdRange } : { clickedAt: { not: null } }) },
      }),
      this.prisma.reviewRequest.count({
        where: {
          localId,
          privateFeedback: { not: null },
          rating: { lte: 3 },
          ...(createdRange ? { completedAt: createdRange } : {}),
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
      rating: { lte: 3 },
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
    const request = await this.prisma.reviewRequest.findFirst({ where: { id, localId }, select: { id: true } });
    if (!request) throw new NotFoundException('Review request not found');
    return this.prisma.reviewRequest.update({
      where: { id: request.id },
      data: { feedbackStatus: ReviewFeedbackStatus.RESOLVED },
    });
  }
}

export const REVIEW_MANAGEMENT_PROVIDER = {
  provide: ENGAGEMENT_REVIEW_MANAGEMENT_PORT,
  useExisting: PrismaReviewManagementAdapter,
};
