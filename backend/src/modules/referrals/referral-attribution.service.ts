import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Prisma, ReferralAttributionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { AttributeReferralDto } from './dto/attribute-referral.dto';
import { ReferralCodeService } from './referral-code.service';
import { ReferralConfigService } from './referral-config.service';
import { RewardsService } from './rewards.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { formatRewardText, normalizeAntiFraud, parseContactTokens, startOfMonth, endOfMonth } from './referral.utils';

const ALLOWED_PENDING_STATUSES: ReferralAttributionStatus[] = [
  ReferralAttributionStatus.ATTRIBUTED,
  ReferralAttributionStatus.BOOKED,
];

const mergeMetadata = (metadata: unknown, extra: Record<string, unknown>) => {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>), ...extra };
  }
  return { ...extra };
};

const toJsonInput = (value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput =>
  value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);

@Injectable()
export class ReferralAttributionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ReferralConfigService,
    private readonly codeService: ReferralCodeService,
    private readonly rewardsService: RewardsService,
    private readonly notificationsService: NotificationsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  private async getActiveConfig() {
    const config = await this.configService.getConfig();
    const moduleEnabled = await this.configService.isModuleEnabled();
    if (!moduleEnabled || !config.enabled) {
      return null;
    }
    return config;
  }

  private async getRewardSummary() {
    const config = await this.configService.getConfig();
    const referrerText = formatRewardText({
      type: config.rewardReferrerType,
      value: config.rewardReferrerValue,
      serviceName: config.rewardReferrerServiceName,
    });
    const referredText = formatRewardText({
      type: config.rewardReferredType,
      value: config.rewardReferredValue,
      serviceName: config.rewardReferredServiceName,
    });
    return {
      referrer: {
        type: config.rewardReferrerType,
        value: config.rewardReferrerValue,
        serviceId: config.rewardReferrerServiceId,
        text: referrerText,
      },
      referred: {
        type: config.rewardReferredType,
        value: config.rewardReferredValue,
        serviceId: config.rewardReferredServiceId,
        text: referredText,
      },
    };
  }

  async getRewardSummaryPayload() {
    return this.getRewardSummary();
  }

  async getReferrerSummary(userId: string) {
    const localId = getCurrentLocalId();
    const config = await this.configService.getConfig();
    const moduleEnabled = await this.configService.isModuleEnabled();
    const blockedBySubscription = await this.subscriptionsService.hasUsableActiveSubscription(
      userId,
      new Date(),
    );
    const code = await this.codeService.getOrCreateCode(userId);
    const rewardSummary = await this.getRewardSummary();
    const attributions = await this.prisma.referralAttribution.findMany({
      where: { localId, referrerUserId: userId },
      include: {
        referredUser: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mapItem = (item: any) => ({
      id: item.id,
      status: item.status,
      attributedAt: item.attributedAt.toISOString(),
      expiresAt: item.expiresAt.toISOString(),
      referred: item.referredUser
        ? item.referredUser
        : { name: null, email: item.referredEmail, phone: item.referredPhone },
    });

    return {
      code: code.code,
      programEnabled: moduleEnabled && config.enabled && !blockedBySubscription,
      blockedBySubscription,
      rewardSummary,
      pending: attributions.filter((item) => item.status === ReferralAttributionStatus.ATTRIBUTED || item.status === ReferralAttributionStatus.BOOKED).map(mapItem),
      confirmed: attributions.filter((item) => item.status === ReferralAttributionStatus.REWARDED || item.status === ReferralAttributionStatus.COMPLETED).map(mapItem),
      expired: attributions.filter((item) => item.status === ReferralAttributionStatus.EXPIRED).map(mapItem),
      invalidated: attributions.filter((item) => item.status === ReferralAttributionStatus.VOIDED).map(mapItem),
    };
  }

  async resolveReferral(code: string) {
    const config = await this.configService.getConfig();
    const moduleEnabled = await this.configService.isModuleEnabled();
    const referral = await this.codeService.resolveCode(code);
    return {
      referrerDisplayName: referral.user.name,
      programEnabled: moduleEnabled && config.enabled,
      rewardSummary: await this.getRewardSummary(),
      expiresInDays: config.attributionExpiryDays,
    };
  }

  private async findExistingAttribution(params: {
    referredUserId?: string | null;
    referredPhone?: string | null;
    referredEmail?: string | null;
  }) {
    const localId = getCurrentLocalId();
    const where: any = { localId, status: { in: ALLOWED_PENDING_STATUSES } };
    if (params.referredUserId) {
      where.referredUserId = params.referredUserId;
    } else if (params.referredPhone || params.referredEmail) {
      where.OR = [
        params.referredPhone ? { referredPhone: params.referredPhone } : undefined,
        params.referredEmail ? { referredEmail: params.referredEmail } : undefined,
      ].filter(Boolean);
    } else {
      return null;
    }
    return this.prisma.referralAttribution.findFirst({ where, orderBy: { createdAt: 'desc' } });
  }

  private async checkNewCustomer(params: { userId?: string | null; phone?: string | null; email?: string | null }) {
    const localId = getCurrentLocalId();
    if (params.userId) {
      const existing = await this.prisma.appointment.findFirst({
        where: { localId, userId: params.userId },
        select: { id: true },
      });
      return !existing;
    }
    if (params.phone || params.email) {
      const conditions = [
        params.email ? { guestContact: { contains: params.email } } : null,
        params.phone ? { guestContact: { contains: params.phone } } : null,
      ].filter(Boolean) as any[];
      const existing = await this.prisma.appointment.findFirst({
        where: {
          localId,
          OR: conditions,
        },
        select: { id: true },
      });
      return !existing;
    }
    return true;
  }

  async attributeReferral(data: AttributeReferralDto) {
    const config = await this.getActiveConfig();
    if (!config) {
      throw new BadRequestException('El programa de referidos está desactivado.');
    }
    const referral = await this.codeService.resolveCode(data.code);
    const antiFraud = normalizeAntiFraud(config.antiFraud);
    const referredUserId = data.userId ?? null;
    const referredEmail = data.referredEmail?.trim() || null;
    const referredPhone = data.referredPhone?.trim() || null;

    const missingContact = !referredUserId && !referredEmail && !referredPhone;

    if (antiFraud.blockSelfByUser && referredUserId && referral.userId === referredUserId) {
      throw new BadRequestException('No puedes auto-referirte.');
    }

    if (antiFraud.blockSelfByContact && (referredEmail || referredPhone)) {
      if (referral.user.email && referral.user.email === referredEmail) {
        throw new BadRequestException('No puedes auto-referirte.');
      }
      if (referral.user.phone && referral.user.phone === referredPhone) {
        throw new BadRequestException('No puedes auto-referirte.');
      }
    }

    if (antiFraud.blockDuplicateContact) {
      const duplicate = await this.findExistingAttribution({ referredUserId, referredEmail, referredPhone });
      if (duplicate) {
        throw new BadRequestException('Este referido ya está registrado.');
      }
    }

    if (config.newCustomerOnly) {
      const isNew = await this.checkNewCustomer({ userId: referredUserId, phone: referredPhone, email: referredEmail });
      if (!isNew) {
        throw new BadRequestException('El referido ya es cliente de este local.');
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.attributionExpiryDays * 24 * 60 * 60 * 1000);

    const created = await this.prisma.referralAttribution.create({
      data: {
        localId: referral.localId,
        referralCodeId: referral.id,
        referrerUserId: referral.userId,
        referredUserId: referredUserId || null,
        referredEmail,
        referredPhone,
        status: ReferralAttributionStatus.ATTRIBUTED,
        attributedAt: now,
        expiresAt,
        metadata: {
          channel: data.channel,
          missingContact,
        },
      },
    });

    return {
      attributionId: created.id,
      expiresAt: created.expiresAt.toISOString(),
    };
  }

  async resolveAttributionForBooking(params: {
    referralAttributionId?: string | null;
    userId?: string | null;
    guestContact?: string | null;
  }) {
    const localId = getCurrentLocalId();
    const now = new Date();
    if (params.referralAttributionId) {
      const attribution = await this.prisma.referralAttribution.findFirst({
        where: { id: params.referralAttributionId, localId },
      });
      if (!attribution) {
        throw new BadRequestException('La atribución del referido no es válida.');
      }
      if (!ALLOWED_PENDING_STATUSES.includes(attribution.status)) return null;
      if (attribution.expiresAt < now) return null;
      return attribution;
    }

    if (params.userId) {
      return this.prisma.referralAttribution.findFirst({
        where: {
          localId,
          referredUserId: params.userId,
          status: { in: ALLOWED_PENDING_STATUSES },
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (params.guestContact) {
      const { email, phone } = parseContactTokens(params.guestContact);
      if (!email && !phone) return null;
      const orFilters: Prisma.ReferralAttributionWhereInput[] = [];
      if (email) orFilters.push({ referredEmail: email });
      if (phone) orFilters.push({ referredPhone: phone });
      return this.prisma.referralAttribution.findFirst({
        where: {
          localId,
          status: { in: ALLOWED_PENDING_STATUSES },
          expiresAt: { gt: now },
          OR: orFilters.length > 0 ? orFilters : undefined,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return null;
  }

  async attachAttributionToAppointment(params: {
    attributionId: string;
    appointmentId: string;
    userId?: string | null;
    guestContact?: string | null;
    tx?: Prisma.TransactionClient;
  }) {
    const client = params.tx ?? this.prisma;
    const localId = getCurrentLocalId();
    const attribution = await client.referralAttribution.findFirst({
      where: { id: params.attributionId, localId },
    });
    if (!attribution) return null;
    if (!ALLOWED_PENDING_STATUSES.includes(attribution.status)) return null;
    if (attribution.expiresAt < new Date()) return null;

    if (attribution.firstAppointmentId && attribution.firstAppointmentId !== params.appointmentId) {
      return null;
    }

    const config = await this.getActiveConfig();
    if (!config) return null;
    const antiFraud = normalizeAntiFraud(config.antiFraud);
    if (antiFraud.blockSelfByUser && params.userId && params.userId === attribution.referrerUserId) {
      return null;
    }

    const contact = parseContactTokens(params.guestContact ?? null);
    if (antiFraud.blockSelfByContact) {
      const referrer = await client.user.findFirst({
        where: { id: attribution.referrerUserId },
        select: { email: true, phone: true },
      });
      if (referrer?.email && contact.email && referrer.email === contact.email) return null;
      if (referrer?.phone && contact.phone && referrer.phone === contact.phone) return null;
    }
    const nextReferredEmail = attribution.referredEmail ?? contact.email;
    const nextReferredPhone = attribution.referredPhone ?? contact.phone;
    const nextReferredUserId = attribution.referredUserId ?? params.userId ?? null;

    await client.referralAttribution.update({
      where: { id: attribution.id },
      data: {
        status: ReferralAttributionStatus.BOOKED,
        firstAppointmentId: params.appointmentId,
        referredUserId: nextReferredUserId,
        referredEmail: nextReferredEmail,
        referredPhone: nextReferredPhone,
      },
    });

    return attribution;
  }

  async handleAppointmentCancelled(appointmentId: string) {
    const localId = getCurrentLocalId();
    const attribution = await this.prisma.referralAttribution.findFirst({
      where: { localId, firstAppointmentId: appointmentId },
    });
    if (!attribution) return;
    if (!ALLOWED_PENDING_STATUSES.includes(attribution.status)) return;
    const expired = attribution.expiresAt < new Date();
    await this.prisma.referralAttribution.update({
      where: { id: attribution.id },
      data: {
        status: expired ? ReferralAttributionStatus.EXPIRED : ReferralAttributionStatus.ATTRIBUTED,
        firstAppointmentId: null,
      },
    });
  }

  async handleAppointmentCompleted(appointmentId: string) {
    const localId = getCurrentLocalId();
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, localId },
      include: { user: true, service: true },
    });
    if (!appointment || appointment.status !== AppointmentStatus.completed) return;
    if (!appointment.referralAttributionId) return;

    const attribution = await this.prisma.referralAttribution.findFirst({
      where: { id: appointment.referralAttributionId, localId },
    });
    if (!attribution) return;
    if (!ALLOWED_PENDING_STATUSES.includes(attribution.status)) return;
    if (attribution.firstAppointmentId && attribution.firstAppointmentId !== appointment.id) return;

    const config = await this.getActiveConfig();
    if (!config) return;

    if (config.allowedServiceIds && !config.allowedServiceIds.includes(appointment.serviceId)) {
      await this.prisma.referralAttribution.update({
        where: { id: attribution.id },
        data: { status: ReferralAttributionStatus.VOIDED, metadata: toJsonInput(mergeMetadata(attribution.metadata, { reason: 'service_not_allowed' })) },
      });
      return;
    }

    if (config.newCustomerOnly) {
      const contact = parseContactTokens(appointment.guestContact ?? null);
      const conditions: any[] = [];
      if (appointment.userId) conditions.push({ userId: appointment.userId });
      if (contact.email) conditions.push({ guestContact: { contains: contact.email } });
      if (contact.phone) conditions.push({ guestContact: { contains: contact.phone } });
      const hasPrevious = await this.prisma.appointment.findFirst({
        where: {
          localId,
          startDateTime: { lt: appointment.startDateTime },
          status: { notIn: ['cancelled', 'no_show'] },
          OR: conditions.length > 0 ? conditions : undefined,
        },
        select: { id: true },
      });
      if (hasPrevious) {
        await this.prisma.referralAttribution.update({
          where: { id: attribution.id },
          data: { status: ReferralAttributionStatus.VOIDED, metadata: toJsonInput(mergeMetadata(attribution.metadata, { reason: 'not_new_customer' })) },
        });
        return;
      }
    }

    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    if (config.monthlyMaxRewardsPerReferrer) {
      const rewardedCount = await this.prisma.referralAttribution.count({
        where: {
          localId,
          referrerUserId: attribution.referrerUserId,
          status: ReferralAttributionStatus.REWARDED,
          updatedAt: { gte: monthStart, lte: monthEnd },
        },
      });
      if (rewardedCount >= config.monthlyMaxRewardsPerReferrer) {
        await this.prisma.referralAttribution.update({
          where: { id: attribution.id },
          data: { status: ReferralAttributionStatus.VOIDED, metadata: toJsonInput(mergeMetadata(attribution.metadata, { reason: 'monthly_limit' })) },
        });
        return;
      }
    }

    await this.prisma.referralAttribution.update({
      where: { id: attribution.id },
      data: { status: ReferralAttributionStatus.COMPLETED },
    });

    const rewardSummary = await this.getRewardSummary();
    const referrerText = rewardSummary.referrer.text;
    const referredText = rewardSummary.referred.text;

    await this.prisma.$transaction(async (tx) => {
      await this.rewardsService.issueReward(
        {
          userId: attribution.referrerUserId,
          referralAttributionId: attribution.id,
          rewardType: config.rewardReferrerType,
          rewardValue: config.rewardReferrerValue,
          rewardServiceId: config.rewardReferrerServiceId,
          description: `Recompensa por referido completado (${referrerText}).`,
        },
        tx,
      );

      if (attribution.referredUserId) {
        await this.rewardsService.issueReward(
          {
            userId: attribution.referredUserId,
            referralAttributionId: attribution.id,
            rewardType: config.rewardReferredType,
            rewardValue: config.rewardReferredValue,
            rewardServiceId: config.rewardReferredServiceId,
            description: `Recompensa de bienvenida (${referredText}).`,
          },
          tx,
        );
      }

      await tx.referralAttribution.update({
        where: { id: attribution.id },
        data: { status: ReferralAttributionStatus.REWARDED },
      });
    });

    const users = await this.prisma.user.findMany({
      where: { id: { in: [attribution.referrerUserId, attribution.referredUserId].filter(Boolean) as string[] } },
      select: { id: true, name: true, email: true, notificationEmail: true },
    });
    const userMap = new Map(users.map((user) => [user.id, user]));
    const referrer = userMap.get(attribution.referrerUserId);
    const referred = attribution.referredUserId ? userMap.get(attribution.referredUserId) : null;

    if (referrer?.email && referrer.notificationEmail !== false) {
      void this.notificationsService.sendReferralRewardEmail({
        contact: { name: referrer.name, email: referrer.email },
        title: 'Recompensa desbloqueada 🎉',
        message: 'Tu invitado completó su primera visita. Recompensa desbloqueada 🎉',
      });
    }

    if (referred?.email && referred.notificationEmail !== false) {
      void this.notificationsService.sendReferralRewardEmail({
        contact: { name: referred.name, email: referred.email },
        title: 'Tu recompensa ya está disponible',
        message: '¡Bienvenido! Has desbloqueado tu recompensa. Ya puedes usarla en tu próxima cita.',
      });
    }
  }

  async listReferrals(params: {
    status?: ReferralAttributionStatus;
    query?: string;
    page: number;
    pageSize: number;
  }) {
    const localId = getCurrentLocalId();
    const where: any = { localId };
    if (params.status) {
      where.status = params.status;
    }
    if (params.query) {
      where.OR = [
        { referrer: { name: { contains: params.query } } },
        { referrer: { email: { contains: params.query } } },
        { referredUser: { name: { contains: params.query } } },
        { referredUser: { email: { contains: params.query } } },
        { referredPhone: { contains: params.query } },
        { referredEmail: { contains: params.query } },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.referralAttribution.count({ where }),
      this.prisma.referralAttribution.findMany({
        where,
        include: {
          referrer: { select: { id: true, name: true, email: true, phone: true } },
          referredUser: { select: { id: true, name: true, email: true, phone: true } },
          firstAppointment: { select: { id: true, startDateTime: true, status: true, price: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);

    return {
      total,
      items: items.map((item) => ({
        id: item.id,
        status: item.status,
        attributedAt: item.attributedAt.toISOString(),
        expiresAt: item.expiresAt.toISOString(),
        referrer: item.referrer,
        referred: item.referredUser
          ? item.referredUser
          : { name: null, email: item.referredEmail, phone: item.referredPhone },
        firstAppointment: item.firstAppointment
          ? {
              id: item.firstAppointment.id,
              startDateTime: item.firstAppointment.startDateTime.toISOString(),
              status: item.firstAppointment.status,
              price: Number(item.firstAppointment.price),
            }
          : null,
      })),
    };
  }

  async getOverview(params: { from?: Date; to?: Date }) {
    const localId = getCurrentLocalId();
    const from = params.from;
    const to = params.to;
    const rangeFilter = from && to ? { gte: from, lte: to } : undefined;

    const [invites, pending, confirmed] = await Promise.all([
      this.prisma.referralAttribution.count({
        where: { localId, ...(rangeFilter ? { createdAt: rangeFilter } : {}) },
      }),
      this.prisma.referralAttribution.count({
        where: {
          localId,
          status: { in: [ReferralAttributionStatus.ATTRIBUTED, ReferralAttributionStatus.BOOKED] },
          ...(rangeFilter ? { createdAt: rangeFilter } : {}),
        },
      }),
      this.prisma.referralAttribution.count({
        where: {
          localId,
          status: { in: [ReferralAttributionStatus.COMPLETED, ReferralAttributionStatus.REWARDED] },
          ...(rangeFilter ? { createdAt: rangeFilter } : {}),
        },
      }),
    ]);

    const revenue = await this.prisma.appointment.aggregate({
      where: {
        localId,
        status: 'completed',
        referralAttributionId: { not: null },
        ...(rangeFilter ? { startDateTime: rangeFilter } : {}),
      },
      _sum: { price: true },
    });

    const top = await this.prisma.referralAttribution.groupBy({
      by: ['referrerUserId'],
      where: {
        localId,
        status: ReferralAttributionStatus.REWARDED,
        ...(rangeFilter ? { updatedAt: rangeFilter } : {}),
      },
      _count: { referrerUserId: true },
      orderBy: { _count: { referrerUserId: 'desc' } },
      take: 5,
    });

    const referrerIds = top.map((item) => item.referrerUserId);
    const referrers = await this.prisma.user.findMany({
      where: { id: { in: referrerIds } },
      select: { id: true, name: true, email: true },
    });
    const referrerMap = referrers.reduce<Record<string, { name: string; email: string }>>((acc, user) => {
      acc[user.id] = { name: user.name, email: user.email };
      return acc;
    }, {});

    return {
      invites,
      pending,
      confirmed,
      revenueAttributable: Number(revenue._sum.price ?? 0),
      topAmbassadors: top.map((item) => ({
        userId: item.referrerUserId,
        count: item._count?.referrerUserId ?? 0,
        name: referrerMap[item.referrerUserId]?.name ?? 'Sin nombre',
        email: referrerMap[item.referrerUserId]?.email ?? null,
      })),
    };
  }

  async voidAttribution(id: string, reason: string) {
    const localId = getCurrentLocalId();
    const attribution = await this.prisma.referralAttribution.findFirst({ where: { id, localId } });
    if (!attribution) throw new NotFoundException('Referral not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.referralAttribution.update({
        where: { id },
        data: { status: ReferralAttributionStatus.VOIDED, metadata: toJsonInput(mergeMetadata(attribution.metadata, { reason })) },
      });
      await this.rewardsService.voidReferralRewards(id, reason, tx);
    });

    return { success: true };
  }
}
