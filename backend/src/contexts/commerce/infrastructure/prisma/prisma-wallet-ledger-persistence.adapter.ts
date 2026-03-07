import { Prisma, RewardTxStatus, RewardTxType } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  CommerceWalletLedgerPersistencePort,
  WalletLedgerCouponRecord,
} from '../../ports/outbound/wallet-ledger-persistence.port';

@Injectable()
export class PrismaWalletLedgerPersistenceAdapter implements CommerceWalletLedgerPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  private getClient(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findWallet(params: {
    localId: string;
    userId: string;
    tx?: unknown;
  }): Promise<{ id: string; balance: number } | null> {
    const wallet = await this.getClient(params.tx).rewardWallet.findFirst({
      where: { localId: params.localId, userId: params.userId },
      select: { id: true, balance: true },
    });
    return wallet ? { id: wallet.id, balance: Number(wallet.balance) } : null;
  }

  async createWallet(params: {
    localId: string;
    userId: string;
    tx?: unknown;
  }): Promise<{ id: string; balance: number }> {
    const wallet = await this.getClient(params.tx).rewardWallet.create({
      data: { localId: params.localId, userId: params.userId, balance: new Prisma.Decimal(0) },
      select: { id: true, balance: true },
    });
    return { id: wallet.id, balance: Number(wallet.balance) };
  }

  async sumPendingWalletHolds(params: { localId: string; userId: string; tx?: unknown }): Promise<number> {
    const holds = await this.getClient(params.tx).rewardTransaction.aggregate({
      where: {
        localId: params.localId,
        userId: params.userId,
        type: RewardTxType.HOLD,
        status: RewardTxStatus.PENDING,
      },
      _sum: { amount: true },
    });
    return Number(holds._sum.amount ?? 0);
  }

  async findCoupon(params: {
    localId: string;
    couponId: string;
    tx?: unknown;
  }): Promise<WalletLedgerCouponRecord | null> {
    const coupon = await this.getClient(params.tx).coupon.findFirst({
      where: { id: params.couponId, localId: params.localId },
      select: {
        id: true,
        userId: true,
        serviceId: true,
        discountType: true,
        discountValue: true,
        isActive: true,
        maxUses: true,
        usedCount: true,
        validFrom: true,
        validTo: true,
      },
    });
    if (!coupon) return null;
    return {
      id: coupon.id,
      userId: coupon.userId,
      serviceId: coupon.serviceId,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue ? Number(coupon.discountValue) : null,
      isActive: coupon.isActive,
      maxUses: coupon.maxUses,
      usedCount: coupon.usedCount,
      validFrom: coupon.validFrom,
      validTo: coupon.validTo,
    };
  }

  async incrementCouponUsedCount(params: { couponId: string; tx?: unknown }): Promise<void> {
    await this.getClient(params.tx).coupon.update({
      where: { id: params.couponId },
      data: { usedCount: { increment: 1 } },
      select: { id: true },
    });
  }

  async createHoldTransaction(params: {
    localId: string;
    userId: string;
    appointmentId: string;
    amount: number;
    description: string;
    tx?: unknown;
  }): Promise<void> {
    await this.getClient(params.tx).rewardTransaction.create({
      data: {
        localId: params.localId,
        userId: params.userId,
        appointmentId: params.appointmentId,
        type: RewardTxType.HOLD,
        status: RewardTxStatus.PENDING,
        amount: new Prisma.Decimal(params.amount),
        description: params.description,
      },
      select: { id: true },
    });
  }

  async createCouponUsageTransaction(params: {
    localId: string;
    userId: string;
    appointmentId: string;
    couponId: string;
    amount: number;
    description: string;
    tx?: unknown;
  }): Promise<void> {
    await this.getClient(params.tx).rewardTransaction.create({
      data: {
        localId: params.localId,
        userId: params.userId,
        appointmentId: params.appointmentId,
        couponId: params.couponId,
        type: RewardTxType.COUPON_USED,
        status: RewardTxStatus.PENDING,
        amount: new Prisma.Decimal(params.amount),
        description: params.description,
      },
      select: { id: true },
    });
  }
}
