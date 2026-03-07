import { Inject, Injectable } from '@nestjs/common';
import { RewardTxStatus, RewardTxType } from '@prisma/client';
import { EngagementReferralMaintenancePort } from '../../../contexts/engagement/ports/outbound/referral-maintenance.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../../contexts/platform/ports/outbound/tenant-context.port';
import { PrismaService } from '../../../prisma/prisma.service';

const HOLD_STALE_DAYS = 7;

@Injectable()
export class PrismaReferralMaintenanceAdapter implements EngagementReferralMaintenancePort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  private getLocalId() {
    return this.tenantContextPort.getRequestContext().localId;
  }

  async expireAttributions() {
    const localId = this.getLocalId();
    const now = new Date();
    const result = await this.prisma.referralAttribution.updateMany({
      where: {
        localId,
        status: { in: ['ATTRIBUTED', 'BOOKED'] },
        expiresAt: { lt: now },
      },
      data: { status: 'EXPIRED', firstAppointmentId: null },
    });
    return result.count;
  }

  async cleanupStaleHolds() {
    const localId = this.getLocalId();
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
              description: 'Liberacion automatica de hold expirado.',
            },
          });
        }
      });
    }

    return holds.length;
  }
}
