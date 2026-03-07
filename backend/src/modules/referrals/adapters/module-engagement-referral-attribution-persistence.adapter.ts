import { Injectable } from '@nestjs/common';
import { Prisma, ReferralAttributionStatus } from '@prisma/client';
import { normalizeEngagementAntiFraud } from '../../../contexts/engagement/domain/services/referral-contact';
import {
  EngagementActiveReferralConfig,
  EngagementReferralAppointmentRecord,
  EngagementReferralAttributionPersistencePort,
  EngagementReferralAttributionRecord,
  EngagementUserNotificationRecord,
} from '../../../contexts/engagement/ports/outbound/referral-attribution-persistence.port';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReferralConfigService } from '../referral-config.service';

const ALLOWED_PENDING_STATUSES: ReferralAttributionStatus[] = [
  ReferralAttributionStatus.ATTRIBUTED,
  ReferralAttributionStatus.BOOKED,
];

@Injectable()
export class ModuleEngagementReferralAttributionPersistenceAdapter
  implements EngagementReferralAttributionPersistencePort
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly referralConfigService: ReferralConfigService,
  ) {}

  private getClient(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  private mapRecord(
    attribution: {
      id: string;
      status: ReferralAttributionStatus;
      expiresAt: Date;
      firstAppointmentId: string | null;
      referrerUserId: string;
      referredUserId: string | null;
      referredEmail: string | null;
      referredPhone: string | null;
      metadata: unknown;
    } | null,
  ): EngagementReferralAttributionRecord | null {
    if (!attribution) return null;
    return {
      id: attribution.id,
      status: attribution.status,
      expiresAt: attribution.expiresAt,
      firstAppointmentId: attribution.firstAppointmentId,
      referrerUserId: attribution.referrerUserId,
      referredUserId: attribution.referredUserId,
      referredEmail: attribution.referredEmail,
      referredPhone: attribution.referredPhone,
      metadata: attribution.metadata,
    };
  }

  async findAttributionById(params: {
    localId: string;
    attributionId: string;
    tx?: unknown;
  }): Promise<EngagementReferralAttributionRecord | null> {
    const attribution = await this.getClient(params.tx).referralAttribution.findFirst({
      where: { id: params.attributionId, localId: params.localId },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        firstAppointmentId: true,
        referrerUserId: true,
        referredUserId: true,
        referredEmail: true,
        referredPhone: true,
        metadata: true,
      },
    });
    return this.mapRecord(attribution);
  }

  async findLatestPendingAttributionByUser(params: {
    localId: string;
    userId: string;
    now: Date;
  }): Promise<EngagementReferralAttributionRecord | null> {
    const attribution = await this.prisma.referralAttribution.findFirst({
      where: {
        localId: params.localId,
        referredUserId: params.userId,
        status: { in: ALLOWED_PENDING_STATUSES },
        expiresAt: { gt: params.now },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        firstAppointmentId: true,
        referrerUserId: true,
        referredUserId: true,
        referredEmail: true,
        referredPhone: true,
        metadata: true,
      },
    });
    return this.mapRecord(attribution);
  }

  async findLatestPendingAttributionByContact(params: {
    localId: string;
    email: string | null;
    phone: string | null;
    now: Date;
  }): Promise<EngagementReferralAttributionRecord | null> {
    const orFilters: Prisma.ReferralAttributionWhereInput[] = [];
    if (params.email) orFilters.push({ referredEmail: params.email });
    if (params.phone) orFilters.push({ referredPhone: params.phone });
    const attribution = await this.prisma.referralAttribution.findFirst({
      where: {
        localId: params.localId,
        status: { in: ALLOWED_PENDING_STATUSES },
        expiresAt: { gt: params.now },
        OR: orFilters.length > 0 ? orFilters : undefined,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        firstAppointmentId: true,
        referrerUserId: true,
        referredUserId: true,
        referredEmail: true,
        referredPhone: true,
        metadata: true,
      },
    });
    return this.mapRecord(attribution);
  }

  async getActiveReferralConfig(): Promise<EngagementActiveReferralConfig | null> {
    const config = await this.referralConfigService.getConfig();
    const moduleEnabled = await this.referralConfigService.isModuleEnabled();
    if (!moduleEnabled || !config.enabled) return null;
    return {
      antiFraud: normalizeEngagementAntiFraud(config.antiFraud),
      newCustomerOnly: config.newCustomerOnly,
      allowedServiceIds: config.allowedServiceIds,
      monthlyMaxRewardsPerReferrer: config.monthlyMaxRewardsPerReferrer,
      rewardReferrerType: config.rewardReferrerType,
      rewardReferrerValue: config.rewardReferrerValue,
      rewardReferrerServiceId: config.rewardReferrerServiceId,
      rewardReferrerServiceName: config.rewardReferrerServiceName,
      rewardReferredType: config.rewardReferredType,
      rewardReferredValue: config.rewardReferredValue,
      rewardReferredServiceId: config.rewardReferredServiceId,
      rewardReferredServiceName: config.rewardReferredServiceName,
    };
  }

  async getUserContact(params: {
    userId: string;
    tx?: unknown;
  }): Promise<{ email: string | null; phone: string | null } | null> {
    const user = await this.getClient(params.tx).user.findFirst({
      where: { id: params.userId },
      select: { email: true, phone: true },
    });
    if (!user) return null;
    return { email: user.email, phone: user.phone };
  }

  async markAttributionBooked(params: {
    attributionId: string;
    appointmentId: string;
    referredUserId: string | null;
    referredEmail: string | null;
    referredPhone: string | null;
    tx?: unknown;
  }): Promise<void> {
    await this.getClient(params.tx).referralAttribution.update({
      where: { id: params.attributionId },
      data: {
        status: ReferralAttributionStatus.BOOKED,
        firstAppointmentId: params.appointmentId,
        referredUserId: params.referredUserId,
        referredEmail: params.referredEmail,
        referredPhone: params.referredPhone,
      },
      select: { id: true },
    });
  }

  async findAttributionByFirstAppointment(params: {
    localId: string;
    appointmentId: string;
  }): Promise<EngagementReferralAttributionRecord | null> {
    const attribution = await this.prisma.referralAttribution.findFirst({
      where: { localId: params.localId, firstAppointmentId: params.appointmentId },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        firstAppointmentId: true,
        referrerUserId: true,
        referredUserId: true,
        referredEmail: true,
        referredPhone: true,
        metadata: true,
      },
    });
    return this.mapRecord(attribution);
  }

  async updateAttributionStatus(params: {
    attributionId: string;
    status: string;
    firstAppointmentId?: string | null;
    metadataReason?: string | null;
    tx?: unknown;
  }): Promise<void> {
    const client = this.getClient(params.tx);
    let metadataUpdate: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined;
    if (params.metadataReason) {
      const existing = await client.referralAttribution.findFirst({
        where: { id: params.attributionId },
        select: { metadata: true },
      });
      const merged =
        existing?.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
          ? { ...(existing.metadata as Record<string, unknown>), reason: params.metadataReason }
          : { reason: params.metadataReason };
      metadataUpdate = merged as Prisma.InputJsonValue;
    }

    await client.referralAttribution.update({
      where: { id: params.attributionId },
      data: {
        status: params.status as ReferralAttributionStatus,
        firstAppointmentId: params.firstAppointmentId,
        metadata: metadataUpdate,
      },
      select: { id: true },
    });
  }

  async findAppointmentForReferralCompletion(params: {
    localId: string;
    appointmentId: string;
  }): Promise<EngagementReferralAppointmentRecord | null> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: params.appointmentId, localId: params.localId },
      select: {
        id: true,
        status: true,
        referralAttributionId: true,
        userId: true,
        serviceId: true,
        guestContact: true,
        startDateTime: true,
      },
    });
    if (!appointment) return null;
    return {
      id: appointment.id,
      status: appointment.status,
      referralAttributionId: appointment.referralAttributionId,
      userId: appointment.userId,
      serviceId: appointment.serviceId,
      guestContact: appointment.guestContact,
      startDateTime: appointment.startDateTime,
    };
  }

  async findPreviousCompletedCustomerAppointment(params: {
    localId: string;
    beforeDate: Date;
    userId: string | null;
    email: string | null;
    phone: string | null;
  }): Promise<boolean> {
    const conditions: Prisma.AppointmentWhereInput[] = [];
    if (params.userId) conditions.push({ userId: params.userId });
    if (params.email) conditions.push({ guestContact: { contains: params.email } });
    if (params.phone) conditions.push({ guestContact: { contains: params.phone } });
    const hasPrevious = await this.prisma.appointment.findFirst({
      where: {
        localId: params.localId,
        startDateTime: { lt: params.beforeDate },
        status: { notIn: ['cancelled', 'no_show'] },
        OR: conditions.length > 0 ? conditions : undefined,
      },
      select: { id: true },
    });
    return Boolean(hasPrevious);
  }

  countRewardedAttributionsByReferrer(params: {
    localId: string;
    referrerUserId: string;
    from: Date;
    to: Date;
  }): Promise<number> {
    return this.prisma.referralAttribution.count({
      where: {
        localId: params.localId,
        referrerUserId: params.referrerUserId,
        status: ReferralAttributionStatus.REWARDED,
        updatedAt: { gte: params.from, lte: params.to },
      },
    });
  }

  runInTransaction<T>(work: (tx: unknown) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(tx));
  }

  async findUsersByIds(params: { ids: string[] }): Promise<EngagementUserNotificationRecord[]> {
    if (params.ids.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: params.ids } },
      select: { id: true, name: true, email: true, notificationEmail: true },
    });
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      notificationEmail: user.notificationEmail,
    }));
  }
}
