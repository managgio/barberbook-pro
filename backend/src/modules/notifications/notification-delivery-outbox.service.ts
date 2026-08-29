import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationDeliveryChannel, NotificationDeliveryKind, NotificationDeliveryStatus, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { decideNotificationDeliveryRetry } from '../../contexts/engagement/domain/services/notification-delivery-retry.policy';
import {
  EngagementNotificationAppointmentAction,
  EngagementNotificationAppointmentInfo,
  EngagementNotificationContactInfo,
  EngagementNotificationDeliveryResult,
  EngagementNotificationManagementPort,
  ENGAGEMENT_NOTIFICATION_MANAGEMENT_PORT,
} from '../../contexts/engagement/ports/outbound/notification-management.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationDeliveryAttemptRecorder } from './notification-delivery-attempt-recorder.service';
import { NotificationDeliveryCriticalReporter } from './notification-delivery-critical-reporter.service';
import {
  NotificationDeliveryEnqueueOptions,
  NotificationDeliveryPayload,
} from './notification-delivery.types';

type PersistenceClient = PrismaService | Prisma.TransactionClient;

const PROCESSING_TIMEOUT_MS = 10 * 60_000;
const toJsonPayload = (payload: NotificationDeliveryPayload) => payload as unknown as Prisma.InputJsonValue;
const hashIdempotencyKey = (value: string) => createHash('sha256').update(value).digest('hex');

const readPayload = (payload: Prisma.JsonValue | null): NotificationDeliveryPayload | null =>
  payload ? payload as unknown as NotificationDeliveryPayload : null;

@Injectable()
export class NotificationDeliveryOutboxService {
  private readonly logger = new Logger(NotificationDeliveryOutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENGAGEMENT_NOTIFICATION_MANAGEMENT_PORT)
    private readonly notificationManagementPort: EngagementNotificationManagementPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
    private readonly attemptRecorder: NotificationDeliveryAttemptRecorder,
    private readonly criticalReporter: NotificationDeliveryCriticalReporter,
  ) {}

  enqueueAppointmentEmail(
    contact: EngagementNotificationContactInfo,
    appointment: EngagementNotificationAppointmentInfo,
    action: EngagementNotificationAppointmentAction,
    options: NotificationDeliveryEnqueueOptions = {},
    client: PersistenceClient = this.prisma,
  ) {
    const kind = action === 'creada'
      ? NotificationDeliveryKind.appointment_created
      : action === 'cancelada'
        ? NotificationDeliveryKind.appointment_cancelled
        : NotificationDeliveryKind.appointment_updated;
    const title = action === 'cancelada' ? 'Tu cita ha sido cancelada' : `Tu cita ha sido ${action}`;
    return this.enqueue({
      channel: NotificationDeliveryChannel.email,
      kind,
      title,
      recipientAddress: contact.email || null,
      recipientName: contact.name || null,
      appointmentId: options.appointmentId || null,
      correlationId: options.correlationId || null,
      idempotencyKey: options.idempotencyKey,
      payload: {
        template: 'appointment_email',
        contact,
        appointment: { ...appointment, date: appointment.date.toISOString() },
        action,
      },
    }, client);
  }

  enqueueBroadcastNotification(
    channel: NotificationDeliveryChannel,
    params: {
      contact: EngagementNotificationContactInfo;
      title?: string;
      message: string;
      date?: string;
      time?: string;
    },
    options: NotificationDeliveryEnqueueOptions = {},
    client: PersistenceClient = this.prisma,
  ) {
    const kind = options.kind === 'earlier_slot'
      ? NotificationDeliveryKind.earlier_slot
      : NotificationDeliveryKind.communication;
    return this.enqueue({
      channel,
      kind,
      title: params.title || this.defaultTitle(channel, kind),
      recipientAddress: channel === NotificationDeliveryChannel.email ? params.contact.email || null : params.contact.phone || null,
      recipientName: params.contact.name || null,
      appointmentId: options.appointmentId || null,
      correlationId: options.correlationId || null,
      idempotencyKey: options.idempotencyKey,
      payload: { template: 'broadcast', channel, ...params },
    }, client);
  }

  enqueueBroadcastEmail(
    params: { contact: EngagementNotificationContactInfo; subject: string; message: string },
    options: NotificationDeliveryEnqueueOptions = {},
    client: PersistenceClient = this.prisma,
  ) {
    return this.enqueueBroadcastNotification(
      NotificationDeliveryChannel.email,
      { contact: params.contact, title: params.subject, message: params.message },
      options,
      client,
    );
  }

  enqueueReminder(
    channel: Exclude<NotificationDeliveryChannel, 'email'>,
    contact: EngagementNotificationContactInfo,
    appointment: EngagementNotificationAppointmentInfo,
    options: NotificationDeliveryEnqueueOptions = {},
    client: PersistenceClient = this.prisma,
  ) {
    return this.enqueue({
      channel,
      kind: NotificationDeliveryKind.reminder,
      title: 'Recordatorio de cita',
      recipientAddress: contact.phone || null,
      recipientName: contact.name || null,
      appointmentId: options.appointmentId || null,
      correlationId: options.correlationId || null,
      idempotencyKey: options.idempotencyKey,
      payload: {
        template: 'reminder',
        channel,
        contact,
        appointment: { ...appointment, date: appointment.date.toISOString() },
      },
    }, client);
  }

  enqueueReferralRewardEmail(
    params: {
      contact: EngagementNotificationContactInfo;
      title: string;
      message: string;
      ctaLabel?: string;
      ctaUrl?: string;
    },
    options: NotificationDeliveryEnqueueOptions = {},
    client: PersistenceClient = this.prisma,
  ) {
    return this.enqueue({
      channel: NotificationDeliveryChannel.email,
      kind: NotificationDeliveryKind.referral_reward,
      title: params.title,
      recipientAddress: params.contact.email || null,
      recipientName: params.contact.name || null,
      appointmentId: options.appointmentId || null,
      correlationId: options.correlationId || null,
      idempotencyKey: options.idempotencyKey,
      payload: { template: 'referral_email', ...params },
    }, client);
  }

  async dispatchDelivery(deliveryId: string) {
    const localId = this.tenantContextPort.getRequestContext().localId;
    const now = new Date();
    const staleBefore = new Date(now.getTime() - PROCESSING_TIMEOUT_MS);
    const claimed = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.notificationDelivery.updateMany({
        where: {
          id: deliveryId,
          localId,
          redactedAt: null,
          OR: [
            {
              status: { in: [NotificationDeliveryStatus.pending, NotificationDeliveryStatus.retrying] },
              OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
            },
            { status: NotificationDeliveryStatus.processing, processingStartedAt: { lte: staleBefore } },
          ],
        },
        data: {
          status: NotificationDeliveryStatus.processing,
          processingStartedAt: now,
          attemptCount: { increment: 1 },
        },
      });
      if (claim.count !== 1) return null;
      return tx.notificationDelivery.findFirst({ where: { id: deliveryId, localId } });
    });
    if (!claimed) return null;

    let result: EngagementNotificationDeliveryResult;
    try {
      const payload = readPayload(claimed.payload);
      if (!payload) throw new Error('Delivery payload is unavailable.');
      result = await this.sendPayload(payload);
    } catch (error) {
      this.logger.error(
        `Unexpected notification outbox failure deliveryId=${claimed.id} channel=${claimed.channel} brandId=${claimed.brandId} localId=${claimed.localId}`,
        error instanceof Error ? error.stack : String(error),
      );
      result = {
        status: 'failed',
        code: 'NOTIFICATION_DELIVERY_INTERNAL_ERROR',
        message: 'An internal error interrupted the notification delivery attempt.',
        retryable: true,
        critical: false,
      };
    }

    if (result.status === 'accepted') {
      await this.attemptRecorder.accepted(claimed.id, claimed.attemptCount, result.providerMessageId || null, now);
      return { status: NotificationDeliveryStatus.accepted };
    }
    if (result.status === 'skipped') {
      await this.attemptRecorder.skipped(claimed.id, claimed.attemptCount, result.code, result.message, now);
      return { status: NotificationDeliveryStatus.skipped, errorCode: result.code };
    }

    const decision = decideNotificationDeliveryRetry({
      now,
      attemptCount: claimed.attemptCount,
      maxAttempts: claimed.maxAttempts,
      retryable: result.retryable,
      critical: result.critical,
    });
    await this.attemptRecorder.failed(claimed.id, claimed.attemptCount, result, decision, now);
    if (decision.promoteToCriticalTrace) await this.criticalReporter.report(claimed, result, now);
    return { status: decision.status, errorCode: result.code };
  }

  private enqueue(
    input: {
      channel: NotificationDeliveryChannel;
      kind: NotificationDeliveryKind;
      title: string;
      recipientAddress: string | null;
      recipientName: string | null;
      appointmentId: string | null;
      correlationId: string | null;
      idempotencyKey?: string;
      payload: NotificationDeliveryPayload;
    },
    client: PersistenceClient,
  ) {
    const context = this.tenantContextPort.getRequestContext();
    const rawKey = input.idempotencyKey || `${input.channel}:${context.brandId}:${context.localId}:${randomUUID()}`;
    const idempotencyKeyHash = hashIdempotencyKey(rawKey);
    return client.notificationDelivery.upsert({
      where: { idempotencyKeyHash },
      update: {},
      create: {
        brandId: context.brandId,
        localId: context.localId,
        appointmentId: input.appointmentId,
        channel: input.channel,
        kind: input.kind,
        idempotencyKeyHash,
        recipientAddress: this.normalizeAddress(input.channel, input.recipientAddress),
        recipientName: input.recipientName?.trim() || null,
        title: input.title.slice(0, 255),
        payload: toJsonPayload(input.payload),
        correlationId: input.correlationId || context.correlationId || null,
        nextAttemptAt: new Date(),
      },
    });
  }

  private sendPayload(payload: NotificationDeliveryPayload) {
    if (payload.template === 'appointment_email') {
      return this.notificationManagementPort.sendAppointmentEmail(
        payload.contact,
        { ...payload.appointment, date: new Date(payload.appointment.date) },
        payload.action,
      );
    }
    if (payload.template === 'referral_email') return this.notificationManagementPort.sendReferralRewardEmail(payload);
    if (payload.template === 'reminder') {
      const appointment = { ...payload.appointment, date: new Date(payload.appointment.date) };
      return payload.channel === NotificationDeliveryChannel.sms
        ? this.notificationManagementPort.sendReminderSms(payload.contact, appointment)
        : this.notificationManagementPort.sendReminderWhatsapp(payload.contact, appointment);
    }
    if (payload.channel === NotificationDeliveryChannel.email) {
      return this.notificationManagementPort.sendBroadcastEmail({
        contact: payload.contact,
        subject: payload.title || 'Comunicado',
        message: payload.message,
      });
    }
    if (payload.channel === NotificationDeliveryChannel.sms) {
      return this.notificationManagementPort.sendBroadcastSms({ contact: payload.contact, message: payload.message });
    }
    return this.notificationManagementPort.sendBroadcastWhatsapp({
      contact: payload.contact,
      message: payload.message,
      date: payload.date,
      time: payload.time,
    });
  }

  private normalizeAddress(channel: NotificationDeliveryChannel, value: string | null) {
    const normalized = value?.trim() || null;
    return channel === NotificationDeliveryChannel.email ? normalized?.toLowerCase() || null : normalized;
  }

  private defaultTitle(channel: NotificationDeliveryChannel, kind: NotificationDeliveryKind) {
    if (kind === NotificationDeliveryKind.earlier_slot) return 'Hueco disponible';
    if (channel === NotificationDeliveryChannel.sms) return 'SMS';
    if (channel === NotificationDeliveryChannel.whatsapp) return 'WhatsApp';
    return 'Comunicado';
  }
}
