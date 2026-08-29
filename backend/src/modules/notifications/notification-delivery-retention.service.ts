import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationDeliveryStatus, Prisma } from '@prisma/client';
import { schedule, ScheduledTask } from 'node-cron';
import { PrismaService } from '../../prisma/prisma.service';
import { DISTRIBUTED_LOCK_PORT, DistributedLockPort } from '../../shared/application/distributed-lock.port';
import {
  NOTIFICATION_DELIVERY_RETENTION,
  resolvedStatuses,
  subtractDays,
} from './notification-delivery-retention.policy';

@Injectable()
export class NotificationDeliveryRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDeliveryRetentionService.name);
  private task: ScheduledTask | null = null;

  constructor(
    @Inject(DISTRIBUTED_LOCK_PORT)
    private readonly distributedLockPort: DistributedLockPort,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.task = schedule('25 3 * * *', () => {
      void this.handleCleanup().catch((error) => {
        this.logger.error(
          'Notification delivery retention cleanup failed',
          error instanceof Error ? error.stack : String(error),
        );
      });
    });
  }

  onModuleDestroy() {
    this.task?.stop();
  }

  async handleCleanup(now = new Date()) {
    return this.distributedLockPort.runWithLock(
      'cron:notification-delivery-retention',
      async () => {
        let totalRedacted = 0;
        let totalDeleted = 0;
        for (let batch = 0; batch < NOTIFICATION_DELIVERY_RETENTION.maxBatchesPerRun; batch += 1) {
          const result = await this.cleanupBatch(now);
          totalRedacted += result.redacted;
          totalDeleted += result.deleted;
          if (
            result.redacted < NOTIFICATION_DELIVERY_RETENTION.batchSize
            && result.deleted < NOTIFICATION_DELIVERY_RETENTION.batchSize
          ) break;
        }
        if (totalRedacted > 0 || totalDeleted > 0) {
          this.logger.log(`Notification retention redacted=${totalRedacted} deleted=${totalDeleted}`);
        }
      },
      { ttlMs: 5 * 60_000, onLockedMessage: 'Skipping notification retention cleanup; lock already held' },
    );
  }

  private async cleanupBatch(now: Date) {
    const resolvedBefore = subtractDays(now, NOTIFICATION_DELIVERY_RETENTION.acceptedOrSkippedDays);
    const failedBefore = subtractDays(now, NOTIFICATION_DELIVERY_RETENTION.failedDays);
    const receiptBefore = subtractDays(now, NOTIFICATION_DELIVERY_RETENTION.redactedReceiptDays);

    // tenant-scope-ignore: global retention applies the same bounded policy to every tenant.
    const candidates = await this.prisma.notificationDelivery.findMany({
      where: {
        redactedAt: null,
        OR: [
          { status: { in: [...resolvedStatuses] }, createdAt: { lte: resolvedBefore } },
          { status: NotificationDeliveryStatus.failed, createdAt: { lte: failedBefore } },
        ],
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: NOTIFICATION_DELIVERY_RETENTION.batchSize,
    });
    const ids = candidates.map((candidate) => candidate.id);
    if (ids.length > 0) {
      await this.prisma.$transaction([
        this.prisma.notificationDeliveryAttempt.deleteMany({ where: { deliveryId: { in: ids } } }),
        this.prisma.notificationDelivery.updateMany({
          where: { id: { in: ids }, redactedAt: null },
          data: {
            recipientAddress: null,
            recipientName: null,
            title: 'Comprobante archivado',
            payload: Prisma.JsonNull,
            appointmentId: null,
            correlationId: null,
            providerMessageId: null,
            lastErrorMessage: null,
            nextAttemptAt: null,
            processingStartedAt: null,
            criticalTraceReportedAt: null,
            redactedAt: now,
          },
        }),
      ]);
    }

    const expired = await this.prisma.notificationDelivery.findMany({
      where: { redactedAt: { lte: receiptBefore } },
      select: { id: true },
      orderBy: { redactedAt: 'asc' },
      take: NOTIFICATION_DELIVERY_RETENTION.batchSize,
    });
    const expiredIds = expired.map((entry) => entry.id);
    if (expiredIds.length > 0) {
      await this.prisma.notificationDelivery.deleteMany({ where: { id: { in: expiredIds } } });
    }

    return { redacted: ids.length, deleted: expiredIds.length };
  }
}
