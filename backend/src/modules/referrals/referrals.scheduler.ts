import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { schedule, ScheduledTask } from 'node-cron';
import { DistributedLockService } from '../../prisma/distributed-lock.service';
import { PrismaService } from '../../prisma/prisma.service';
import { runForEachActiveLocation } from '../../tenancy/tenant.utils';
import { RewardTxStatus, RewardTxType } from '@prisma/client';
import { getCurrentLocalId } from '../../tenancy/tenant.context';

const HOLD_STALE_DAYS = 7;

@Injectable()
export class ReferralsSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReferralsSchedulerService.name);
  private task: ScheduledTask | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly distributedLock: DistributedLockService,
  ) {}

  onModuleInit() {
    this.task = schedule('0 3 * * *', () => {
      void this.handleDaily();
    });
  }

  onModuleDestroy() {
    this.task?.stop();
  }

  private async handleDaily() {
    const executed = await this.distributedLock.runWithLock(
      'cron:referrals-daily',
      async () => {
        await this.runDaily();
      },
      {
        ttlMs: 45 * 60_000,
        onLockedMessage: 'Skipping referrals daily job in this instance; lock already held',
      },
    );
    if (!executed) return;
  }

  private async runDaily() {
    try {
      await runForEachActiveLocation(this.prisma, async ({ brandId, localId }) => {
        try {
          await this.expireAttributions();
          await this.cleanupStaleHolds();
        } catch (error) {
          this.logger.error(
            `Referral scheduler failed for ${brandId}/${localId}.`,
            error instanceof Error ? error.stack : `${error}`,
          );
        }
      });
    } catch (error) {
      this.logger.error(
        'Referral scheduler failed.',
        error instanceof Error ? error.stack : `${error}`,
      );
    }
  }

  private async expireAttributions() {
    const localId = getCurrentLocalId();
    const now = new Date();
    await this.prisma.referralAttribution.updateMany({
      where: {
        localId,
        status: { in: ['ATTRIBUTED', 'BOOKED'] },
        expiresAt: { lt: now },
      },
      data: { status: 'EXPIRED', firstAppointmentId: null },
    });
  }

  private async cleanupStaleHolds() {
    const localId = getCurrentLocalId();
    const threshold = new Date(Date.now() - HOLD_STALE_DAYS * 24 * 60 * 60 * 1000);
    const holds = await this.prisma.rewardTransaction.findMany({
      where: {
        localId,
        type: RewardTxType.HOLD,
        status: RewardTxStatus.PENDING,
        createdAt: { lt: threshold },
      },
    });

    for (const hold of holds) {
      await this.prisma.$transaction(async (tx) => {
        await tx.rewardTransaction.update({
          where: { id: hold.id },
          data: { status: RewardTxStatus.CANCELLED },
        });
        if (hold.amount) {
          await tx.rewardTransaction.create({
            data: {
              localId: hold.localId,
              userId: hold.userId,
              appointmentId: hold.appointmentId,
              type: RewardTxType.RELEASE,
              status: RewardTxStatus.CONFIRMED,
              amount: hold.amount,
              description: 'Liberación automática de hold expirado.',
            },
          });
        }
      });
    }
  }
}
