import { Injectable } from '@nestjs/common';
import {
  NotificationDeliveryAttemptStatus,
  NotificationDeliveryStatus,
} from '@prisma/client';
import { NotificationDeliveryRetryDecision } from '../../contexts/engagement/domain/services/notification-delivery-retry.policy';
import { EngagementNotificationDeliveryResult } from '../../contexts/engagement/ports/outbound/notification-management.port';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationDeliveryAttemptRecorder {
  constructor(private readonly prisma: PrismaService) {}

  async accepted(
    id: string,
    attemptNumber: number,
    attemptReference: string,
    providerMessageId: string | null,
    now: Date,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const attemptScope = {
        id,
        attemptCount: attemptNumber,
        activeAttemptReference: attemptReference,
      };
      const accepted = await tx.notificationDelivery.updateMany({
        where: { ...attemptScope, status: NotificationDeliveryStatus.processing },
        data: {
          status: NotificationDeliveryStatus.accepted,
          acceptedAt: now,
          providerMessageId,
          nextAttemptAt: null,
          processingStartedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });
      let ownsAttempt = accepted.count === 1;
      if (accepted.count === 0) {
        // A provider callback can beat this write. Preserve its more advanced terminal state
        // while still attaching the provider ID and API acceptance timestamp.
        const reconciled = await tx.notificationDelivery.updateMany({
          where: {
            ...attemptScope,
            status: {
              in: [
                NotificationDeliveryStatus.sent,
                NotificationDeliveryStatus.delivered,
                NotificationDeliveryStatus.undelivered,
              ],
            },
            OR: [
              { providerMessageId: null },
              ...(providerMessageId ? [{ providerMessageId }] : []),
            ],
          },
          data: {
            acceptedAt: now,
            ...(providerMessageId ? { providerMessageId } : {}),
          },
        });
        ownsAttempt = reconciled.count === 1;
      }
      if (!ownsAttempt) return false;
      await tx.notificationDeliveryAttempt.create({
        data: { deliveryId: id, attemptNumber, status: NotificationDeliveryAttemptStatus.accepted, providerMessageId },
      });
      return true;
    });
  }

  async skipped(
    id: string,
    attemptNumber: number,
    attemptReference: string,
    code: string,
    message: string,
    now: Date,
  ) {
    const safeMessage = message.slice(0, 500);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.notificationDelivery.updateMany({
        where: {
          id,
          attemptCount: attemptNumber,
          activeAttemptReference: attemptReference,
          status: NotificationDeliveryStatus.processing,
        },
        data: {
          status: NotificationDeliveryStatus.skipped,
          skippedAt: now,
          nextAttemptAt: null,
          processingStartedAt: null,
          lastErrorCode: code,
          lastErrorMessage: safeMessage,
        },
      });
      if (updated.count !== 1) return false;
      await tx.notificationDeliveryAttempt.create({
        data: {
          deliveryId: id,
          attemptNumber,
          status: NotificationDeliveryAttemptStatus.skipped,
          errorCode: code,
          errorMessage: safeMessage,
        },
      });
      return true;
    });
  }

  async failed(
    id: string,
    attemptNumber: number,
    attemptReference: string,
    result: Extract<EngagementNotificationDeliveryResult, { status: 'failed' }>,
    decision: NotificationDeliveryRetryDecision,
    now: Date,
  ) {
    const safeMessage = result.message.slice(0, 500);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.notificationDelivery.updateMany({
        where: {
          id,
          attemptCount: attemptNumber,
          activeAttemptReference: attemptReference,
          status: NotificationDeliveryStatus.processing,
        },
        data: {
          status: decision.status === 'retrying' ? NotificationDeliveryStatus.retrying : NotificationDeliveryStatus.failed,
          nextAttemptAt: decision.nextAttemptAt,
          processingStartedAt: null,
          failedAt: decision.status === 'failed' ? now : null,
          lastErrorCode: result.code,
          lastErrorMessage: safeMessage,
        },
      });
      if (updated.count !== 1) return false;
      await tx.notificationDeliveryAttempt.create({
        data: {
          deliveryId: id,
          attemptNumber,
          status: NotificationDeliveryAttemptStatus.failed,
          errorCode: result.code,
          errorMessage: safeMessage,
        },
      });
      return true;
    });
  }
}
