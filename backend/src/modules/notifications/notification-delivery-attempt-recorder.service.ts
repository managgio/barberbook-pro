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

  async accepted(id: string, attemptNumber: number, providerMessageId: string | null, now: Date) {
    await this.prisma.$transaction([
      this.prisma.notificationDelivery.update({
        where: { id },
        data: {
          status: NotificationDeliveryStatus.accepted,
          acceptedAt: now,
          providerMessageId,
          nextAttemptAt: null,
          processingStartedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      }),
      this.prisma.notificationDeliveryAttempt.create({
        data: { deliveryId: id, attemptNumber, status: NotificationDeliveryAttemptStatus.accepted, providerMessageId },
      }),
    ]);
  }

  async skipped(id: string, attemptNumber: number, code: string, message: string, now: Date) {
    const safeMessage = message.slice(0, 500);
    await this.prisma.$transaction([
      this.prisma.notificationDelivery.update({
        where: { id },
        data: {
          status: NotificationDeliveryStatus.skipped,
          skippedAt: now,
          nextAttemptAt: null,
          processingStartedAt: null,
          lastErrorCode: code,
          lastErrorMessage: safeMessage,
        },
      }),
      this.prisma.notificationDeliveryAttempt.create({
        data: {
          deliveryId: id,
          attemptNumber,
          status: NotificationDeliveryAttemptStatus.skipped,
          errorCode: code,
          errorMessage: safeMessage,
        },
      }),
    ]);
  }

  async failed(
    id: string,
    attemptNumber: number,
    result: Extract<EngagementNotificationDeliveryResult, { status: 'failed' }>,
    decision: NotificationDeliveryRetryDecision,
    now: Date,
  ) {
    const safeMessage = result.message.slice(0, 500);
    await this.prisma.$transaction([
      this.prisma.notificationDelivery.update({
        where: { id },
        data: {
          status: decision.status === 'retrying' ? NotificationDeliveryStatus.retrying : NotificationDeliveryStatus.failed,
          nextAttemptAt: decision.nextAttemptAt,
          processingStartedAt: null,
          failedAt: decision.status === 'failed' ? now : null,
          lastErrorCode: result.code,
          lastErrorMessage: safeMessage,
        },
      }),
      this.prisma.notificationDeliveryAttempt.create({
        data: {
          deliveryId: id,
          attemptNumber,
          status: NotificationDeliveryAttemptStatus.failed,
          errorCode: result.code,
          errorMessage: safeMessage,
        },
      }),
    ]);
  }
}
