import { Inject, Injectable } from '@nestjs/common';
import {
  NotificationDeliveryChannel,
  NotificationDeliveryKind,
  NotificationDeliveryStatus,
  Prisma,
} from '@prisma/client';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantConfigService } from '../../tenancy/tenant-config.service';
import { NotificationDeliveryOutboxService } from './notification-delivery-outbox.service';
import { NotificationDeliveryListFilters } from './notification-delivery.types';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const INCIDENT_STATUSES = [
  NotificationDeliveryStatus.pending,
  NotificationDeliveryStatus.processing,
  NotificationDeliveryStatus.retrying,
  NotificationDeliveryStatus.failed,
];
const DISABLED_CODES = [
  'EMAIL_DISABLED',
  'SMS_DISABLED',
  'WHATSAPP_DISABLED',
];
const MISSING_RECIPIENT_CODES = [
  'EMAIL_RECIPIENT_MISSING',
  'PHONE_RECIPIENT_MISSING',
];

const maskRecipient = (channel: NotificationDeliveryChannel, address?: string | null) => {
  const normalized = (address || '').trim();
  if (!normalized) return null;
  if (channel !== NotificationDeliveryChannel.email) {
    const visible = normalized.slice(-2);
    return `${'*'.repeat(Math.max(3, Math.min(9, normalized.length - visible.length)))}${visible}`;
  }
  const separator = normalized.lastIndexOf('@');
  if (separator <= 0) return '***';
  const name = normalized.slice(0, separator);
  const domain = normalized.slice(separator + 1);
  return `${name.slice(0, 1)}${'*'.repeat(Math.min(5, Math.max(3, name.length - 1)))}@${domain}`;
};

const clampPagination = (filters: NotificationDeliveryListFilters) => ({
  page: Math.max(1, Math.floor(filters.page || 1)),
  pageSize: Math.min(MAX_PAGE_SIZE, Math.max(10, Math.floor(filters.pageSize || DEFAULT_PAGE_SIZE))),
});

const isEnumValue = <T extends string>(values: T[], value?: string): value is T =>
  Boolean(value && values.includes(value as T));

@Injectable()
export class NotificationDeliveryHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
    private readonly tenantConfigService: TenantConfigService,
    private readonly outbox: NotificationDeliveryOutboxService,
  ) {}

  async listForCurrentTenant(filters: NotificationDeliveryListFilters) {
    const context = this.tenantContextPort.getRequestContext();
    const enabledChannels = await this.getEnabledChannels();
    return this.list(
      { ...filters, brandId: context.brandId, localId: context.localId },
      false,
      enabledChannels,
    );
  }

  listForPlatform(filters: NotificationDeliveryListFilters) {
    return this.list(filters, true, Object.values(NotificationDeliveryChannel));
  }

  listPlatformFilterOptions() {
    // tenant-scope-ignore: platform-admin filter metadata is guarded by PlatformAdminGuard.
    return this.prisma.brand.findMany({
      select: {
        id: true,
        name: true,
        locations: {
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async retryForCurrentTenant(deliveryId: string) {
    const localId = this.tenantContextPort.getRequestContext().localId;
    const enabledChannels = await this.getEnabledChannels();
    const updated = await this.prisma.notificationDelivery.updateMany({
      where: {
        id: deliveryId,
        localId,
        redactedAt: null,
        channel: { in: enabledChannels },
        status: { in: [NotificationDeliveryStatus.failed, NotificationDeliveryStatus.skipped] },
        NOT: {
          status: NotificationDeliveryStatus.skipped,
          lastErrorCode: { in: MISSING_RECIPIENT_CODES },
        },
      },
      data: {
        status: NotificationDeliveryStatus.pending,
        nextAttemptAt: new Date(),
        processingStartedAt: null,
        failedAt: null,
        skippedAt: null,
        criticalTraceReportedAt: null,
        maxAttempts: { increment: 1 },
      },
    });
    if (updated.count !== 1) return { success: false };
    const result = await this.outbox.dispatchDelivery(deliveryId);
    return { success: true, result };
  }

  private async list(
    filters: NotificationDeliveryListFilters,
    platform: boolean,
    enabledChannels: NotificationDeliveryChannel[],
  ) {
    const { page, pageSize } = clampPagination(filters);
    const status = isEnumValue(Object.values(NotificationDeliveryStatus), filters.status) ? filters.status : undefined;
    const kind = isEnumValue(Object.values(NotificationDeliveryKind), filters.kind) ? filters.kind : undefined;
    const requestedChannel = isEnumValue(Object.values(NotificationDeliveryChannel), filters.channel)
      ? filters.channel
      : undefined;
    const channel = requestedChannel && enabledChannels.includes(requestedChannel) ? requestedChannel : undefined;

    const baseWhere: Prisma.NotificationDeliveryWhereInput = {
      redactedAt: null,
      channel: channel ? channel : { in: enabledChannels },
      ...(kind ? { kind } : {}),
      ...(filters.brandId ? { brandId: filters.brandId } : {}),
      ...(filters.localId ? { localId: filters.localId } : {}),
    };
    if (!platform && (!baseWhere.brandId || !baseWhere.localId)) {
      throw new Error('Tenant scope is required for notification delivery history.');
    }
    const incidentWhere: Prisma.NotificationDeliveryWhereInput = filters.includeResolved || status
      ? {}
      : {
          OR: [
            { status: { in: INCIDENT_STATUSES } },
            { status: NotificationDeliveryStatus.skipped, lastErrorCode: { notIn: DISABLED_CODES } },
          ],
        };
    const where: Prisma.NotificationDeliveryWhereInput = {
      AND: [baseWhere, incidentWhere, ...(status ? [{ status }] : [])],
    };

    // tenant-scope-ignore: platform-admin global delivery overview is guarded by PlatformAdminGuard.
    const [total, items, grouped] = await this.prisma.$transaction([
      this.prisma.notificationDelivery.count({ where }),
      this.prisma.notificationDelivery.findMany({
        where,
        include: {
          brand: { select: { name: true } },
          local: { select: { name: true } },
          attempts: { orderBy: { attemptNumber: 'desc' }, take: 5 },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notificationDelivery.groupBy({
        by: ['status'],
        where: { AND: [baseWhere, incidentWhere] },
        orderBy: { status: 'asc' },
        _count: { id: true },
      }),
    ]);
    const counts = Object.fromEntries(Object.values(NotificationDeliveryStatus).map((value) => [value, 0]));
    grouped.forEach((row) => {
      if (row._count && typeof row._count !== 'boolean') counts[row.status] = row._count.id ?? 0;
    });
    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      enabledChannels,
      items: items.map((item) => ({
        id: item.id,
        brandId: item.brandId,
        brandName: item.brand.name,
        localId: item.localId,
        localName: item.local.name,
        appointmentId: item.appointmentId,
        channel: item.channel,
        kind: item.kind,
        status: item.status,
        recipient: maskRecipient(item.channel, item.recipientAddress),
        recipientName: item.recipientName,
        title: item.title,
        attemptCount: item.attemptCount,
        maxAttempts: item.maxAttempts,
        nextAttemptAt: item.nextAttemptAt?.toISOString() || null,
        providerMessageId: item.providerMessageId,
        lastErrorCode: item.lastErrorCode,
        lastErrorMessage: item.lastErrorMessage,
        acceptedAt: item.acceptedAt?.toISOString() || null,
        failedAt: item.failedAt?.toISOString() || null,
        skippedAt: item.skippedAt?.toISOString() || null,
        createdAt: item.createdAt.toISOString(),
        attempts: item.attempts.map((attempt) => ({
          id: attempt.id.toString(),
          attemptNumber: attempt.attemptNumber,
          status: attempt.status,
          providerMessageId: attempt.providerMessageId,
          errorCode: attempt.errorCode,
          errorMessage: attempt.errorMessage,
          occurredAt: attempt.occurredAt.toISOString(),
        })),
      })),
      counts,
    };
  }

  private async getEnabledChannels() {
    const config = await this.tenantConfigService.getEffectiveConfig();
    return Object.values(NotificationDeliveryChannel).filter((channel) => config.notificationPrefs?.[channel] !== false);
  }
}
