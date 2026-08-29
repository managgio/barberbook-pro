import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationDeliveryStatus } from '@prisma/client';
import { schedule, ScheduledTask } from 'node-cron';
import {
  TENANT_CONTEXT_RUNNER_PORT,
  TenantContextRunnerPort,
} from '../../contexts/platform/ports/outbound/tenant-context-runner.port';
import { PrismaService } from '../../prisma/prisma.service';
import { DISTRIBUTED_LOCK_PORT, DistributedLockPort } from '../../shared/application/distributed-lock.port';
import { NotificationDeliveryOutboxService } from './notification-delivery-outbox.service';

const PROCESSING_TIMEOUT_MS = 10 * 60_000;
const BATCH_SIZE = 100;

@Injectable()
export class NotificationDeliveryWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDeliveryWorkerService.name);
  private task: ScheduledTask | null = null;

  constructor(
    @Inject(DISTRIBUTED_LOCK_PORT)
    private readonly distributedLockPort: DistributedLockPort,
    @Inject(TENANT_CONTEXT_RUNNER_PORT)
    private readonly tenantContextRunnerPort: TenantContextRunnerPort,
    private readonly prisma: PrismaService,
    private readonly outbox: NotificationDeliveryOutboxService,
  ) {}

  onModuleInit() {
    this.task = schedule('* * * * *', () => {
      void this.handleTick().catch((error) => {
        this.logger.error(
          'Notification delivery outbox tick failed',
          error instanceof Error ? error.stack : String(error),
        );
      });
    });
  }

  onModuleDestroy() {
    this.task?.stop();
  }

  private async handleTick() {
    await this.distributedLockPort.runWithLock(
      'cron:notification-delivery-outbox',
      () => this.processDueBatch(),
      { ttlMs: 2 * 60_000, onLockedMessage: 'Skipping notification outbox tick; lock already held' },
    );
  }

  private async processDueBatch() {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - PROCESSING_TIMEOUT_MS);
    // tenant-scope-ignore: global dispatcher restores the tenant context for every selected row.
    const due = await this.prisma.notificationDelivery.findMany({
      where: {
        redactedAt: null,
        local: { isActive: true, brand: { isActive: true } },
        OR: [
          {
            status: { in: [NotificationDeliveryStatus.pending, NotificationDeliveryStatus.retrying] },
            OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
          },
          { status: NotificationDeliveryStatus.processing, processingStartedAt: { lte: staleBefore } },
        ],
      },
      select: { id: true, brandId: true, localId: true },
      orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
      take: BATCH_SIZE,
    });

    let failures = 0;
    for (const delivery of due) {
      try {
        await this.tenantContextRunnerPort.runWithContext(
          { brandId: delivery.brandId, localId: delivery.localId },
          () => this.outbox.dispatchDelivery(delivery.id),
        );
      } catch (error) {
        failures += 1;
        this.logger.error(
          `Notification worker failed deliveryId=${delivery.id} brandId=${delivery.brandId} localId=${delivery.localId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    if (failures > 0) {
      this.logger.warn(`Notification outbox batch completed with failures=${failures} total=${due.length}`);
    }
  }
}
