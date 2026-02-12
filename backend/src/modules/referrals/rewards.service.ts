import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RewardTxStatus, RewardTxType, RewardType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

const DEFAULT_TX_LIMIT = 12;

@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  private async ensureWallet(userId: string, localId: string, tx?: Prisma.TransactionClient) {
    const client = this.getClient(tx);
    const existing = await client.rewardWallet.findFirst({ where: { userId, localId } });
    if (existing) return existing;
    return client.rewardWallet.create({ data: { userId, localId, balance: new Prisma.Decimal(0) } });
  }

  private async getPendingHoldsTotal(userId: string, localId: string, tx?: Prisma.TransactionClient) {
    const client = this.getClient(tx);
    const holds = await client.rewardTransaction.aggregate({
      where: { userId, localId, type: RewardTxType.HOLD, status: RewardTxStatus.PENDING },
      _sum: { amount: true },
    });
    return Number(holds._sum.amount ?? 0);
  }

  async getWalletSummary(userId: string) {
    const localId = getCurrentLocalId();
    const blockedBySubscription = await this.subscriptionsService.hasUsableActiveSubscription(
      userId,
      new Date(),
    );
    const wallet = await this.ensureWallet(userId, localId);
    const pendingHolds = await this.getPendingHoldsTotal(userId, localId);
    const availableBalance = blockedBySubscription
      ? 0
      : Math.max(0, Number(wallet.balance) - pendingHolds);
    const transactions = await this.prisma.rewardTransaction.findMany({
      where: { userId, localId },
      orderBy: { createdAt: 'desc' },
      take: DEFAULT_TX_LIMIT,
    });
    const coupons = blockedBySubscription
      ? []
      : await this.prisma.coupon.findMany({
          where: { localId, userId, isActive: true },
          orderBy: { createdAt: 'desc' },
        });
    return {
      blockedBySubscription,
      wallet: {
        balance: Number(wallet.balance),
        availableBalance,
        pendingHolds,
      },
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        status: tx.status,
        amount: tx.amount ? Number(tx.amount) : null,
        description: tx.description,
        createdAt: tx.createdAt.toISOString(),
      })),
      coupons: coupons.map((coupon) => ({
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue ? Number(coupon.discountValue) : null,
        serviceId: coupon.serviceId ?? null,
        isActive: coupon.isActive,
        maxUses: coupon.maxUses,
        usedCount: coupon.usedCount,
        validFrom: coupon.validFrom ? coupon.validFrom.toISOString() : null,
        validTo: coupon.validTo ? coupon.validTo.toISOString() : null,
        createdAt: coupon.createdAt.toISOString(),
      })),
    };
  }

  async getAvailableBalance(userId: string, tx?: Prisma.TransactionClient) {
    const localId = getCurrentLocalId();
    const wallet = await this.ensureWallet(userId, localId, tx);
    const pendingHolds = await this.getPendingHoldsTotal(userId, localId, tx);
    return Math.max(0, Number(wallet.balance) - pendingHolds);
  }

  async reserveWalletHold(params: {
    userId: string;
    appointmentId: string;
    amount: number;
    description: string;
  }, tx?: Prisma.TransactionClient) {
    const localId = getCurrentLocalId();
    if (params.amount <= 0) return 0;
    const client = this.getClient(tx);
    await this.ensureWallet(params.userId, localId, tx);
    await client.rewardTransaction.create({
      data: {
        localId,
        userId: params.userId,
        appointmentId: params.appointmentId,
        type: RewardTxType.HOLD,
        status: RewardTxStatus.PENDING,
        amount: new Prisma.Decimal(params.amount),
        description: params.description,
      },
    });
    return params.amount;
  }

  async confirmWalletHold(appointmentId: string, tx?: Prisma.TransactionClient) {
    const localId = getCurrentLocalId();
    const client = this.getClient(tx);
    const holds = await client.rewardTransaction.findMany({
      where: {
        localId,
        appointmentId,
        type: RewardTxType.HOLD,
        status: RewardTxStatus.PENDING,
      },
    });
    for (const hold of holds) {
      const amount = Number(hold.amount ?? 0);
      if (amount <= 0) continue;
      await client.rewardTransaction.update({
        where: { id: hold.id },
        data: { status: RewardTxStatus.CONFIRMED },
      });
      await client.rewardTransaction.create({
        data: {
          localId: hold.localId,
          userId: hold.userId,
          appointmentId: hold.appointmentId,
          type: RewardTxType.DEBIT,
          status: RewardTxStatus.CONFIRMED,
          amount: hold.amount,
          description: 'Débito de saldo por cita completada.',
        },
      });
      await client.rewardWallet.update({
        where: { id: (await this.ensureWallet(hold.userId, hold.localId, tx)).id },
        data: { balance: { decrement: amount } },
      });
    }
  }

  async releaseWalletHold(appointmentId: string, tx?: Prisma.TransactionClient) {
    const localId = getCurrentLocalId();
    const client = this.getClient(tx);
    const holds = await client.rewardTransaction.findMany({
      where: {
        localId,
        appointmentId,
        type: RewardTxType.HOLD,
        status: RewardTxStatus.PENDING,
      },
    });
    for (const hold of holds) {
      const amount = Number(hold.amount ?? 0);
      await client.rewardTransaction.update({
        where: { id: hold.id },
        data: { status: RewardTxStatus.CANCELLED },
      });
      if (amount > 0) {
        await client.rewardTransaction.create({
          data: {
            localId: hold.localId,
            userId: hold.userId,
            appointmentId: hold.appointmentId,
            type: RewardTxType.RELEASE,
            status: RewardTxStatus.CONFIRMED,
            amount: hold.amount,
            description: 'Liberación de saldo por cancelación de cita.',
          },
        });
      }
    }
  }

  async validateCoupon(params: {
    userId: string;
    couponId: string;
    serviceId: string;
    referenceDate: Date;
  }, tx?: Prisma.TransactionClient) {
    const localId = getCurrentLocalId();
    const client = this.getClient(tx);
    const coupon = await client.coupon.findFirst({ where: { id: params.couponId, localId } });
    if (!coupon) throw new NotFoundException('Cupón no encontrado.');
    if (!coupon.isActive) throw new BadRequestException('El cupón no está activo.');
    if (coupon.discountType === RewardType.WALLET) {
      throw new BadRequestException('Tipo de cupón no válido.');
    }
    if (coupon.userId && coupon.userId !== params.userId) {
      throw new BadRequestException('El cupón no pertenece a este usuario.');
    }
    if (coupon.validFrom && params.referenceDate < coupon.validFrom) {
      throw new BadRequestException('El cupón aún no es válido.');
    }
    if (coupon.validTo && params.referenceDate > coupon.validTo) {
      throw new BadRequestException('El cupón ha caducado.');
    }
    if (coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('El cupón ya se ha utilizado.');
    }
    if (coupon.serviceId && coupon.serviceId !== params.serviceId) {
      throw new BadRequestException('El cupón no aplica a este servicio.');
    }
    return coupon;
  }

  calculateCouponDiscount(params: { couponType: RewardType; couponValue: number | null; baseServicePrice: number }) {
    const base = Math.max(0, params.baseServicePrice);
    if (base <= 0) return 0;
    if (params.couponType === RewardType.FREE_SERVICE) return base;
    if (params.couponType === RewardType.PERCENT_DISCOUNT) {
      const value = Math.max(0, Number(params.couponValue ?? 0));
      return Math.min(base, base * (value / 100));
    }
    if (params.couponType === RewardType.FIXED_DISCOUNT) {
      const value = Math.max(0, Number(params.couponValue ?? 0));
      return Math.min(base, value);
    }
    return 0;
  }

  async reserveCouponUsage(params: {
    userId: string;
    couponId: string;
    appointmentId: string;
    amount: number;
    description: string;
  }, tx?: Prisma.TransactionClient) {
    const localId = getCurrentLocalId();
    const client = this.getClient(tx);
    const coupon = await client.coupon.findFirst({ where: { id: params.couponId, localId } });
    if (!coupon) throw new NotFoundException('Cupón no encontrado.');
    await client.coupon.update({
      where: { id: params.couponId },
      data: { usedCount: { increment: 1 } },
    });
    await client.rewardTransaction.create({
      data: {
        localId,
        userId: params.userId,
        appointmentId: params.appointmentId,
        couponId: params.couponId,
        type: RewardTxType.COUPON_USED,
        status: RewardTxStatus.PENDING,
        amount: new Prisma.Decimal(params.amount),
        description: params.description,
      },
    });
  }

  async confirmCouponUsage(appointmentId: string, tx?: Prisma.TransactionClient) {
    const localId = getCurrentLocalId();
    const client = this.getClient(tx);
    await client.rewardTransaction.updateMany({
      where: { localId, appointmentId, type: RewardTxType.COUPON_USED, status: RewardTxStatus.PENDING },
      data: { status: RewardTxStatus.CONFIRMED },
    });
  }

  async cancelCouponUsage(appointmentId: string, tx?: Prisma.TransactionClient) {
    const localId = getCurrentLocalId();
    const client = this.getClient(tx);
    const txs = await client.rewardTransaction.findMany({
      where: { localId, appointmentId, type: RewardTxType.COUPON_USED, status: RewardTxStatus.PENDING },
    });
    for (const entry of txs) {
      if (entry.couponId) {
        const coupon = await client.coupon.findFirst({ where: { id: entry.couponId, localId } });
        if (coupon && coupon.usedCount > 0) {
          await client.coupon.update({
            where: { id: entry.couponId },
            data: { usedCount: { decrement: 1 } },
          });
        }
      }
      await client.rewardTransaction.update({
        where: { id: entry.id },
        data: { status: RewardTxStatus.CANCELLED },
      });
    }
  }

  async issueReward(params: {
    userId: string;
    referralAttributionId: string;
    rewardType: RewardType;
    rewardValue: number | null;
    rewardServiceId?: string | null;
    description: string;
  }, tx?: Prisma.TransactionClient) {
    const localId = getCurrentLocalId();
    const client = this.getClient(tx);

    if (params.rewardType === RewardType.WALLET) {
      const amount = Math.max(0, Number(params.rewardValue ?? 0));
      if (amount <= 0) return;
      const wallet = await this.ensureWallet(params.userId, localId, tx);
      await client.rewardWallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      });
      await client.rewardTransaction.create({
        data: {
          localId,
          userId: params.userId,
          referralAttributionId: params.referralAttributionId,
          type: RewardTxType.CREDIT,
          status: RewardTxStatus.CONFIRMED,
          amount: new Prisma.Decimal(amount),
          description: params.description,
        },
      });
      return;
    }

    if (params.rewardType === RewardType.FREE_SERVICE && !params.rewardServiceId) {
      throw new BadRequestException('Servicio obligatorio para recompensa gratuita.');
    }

    const coupon = await client.coupon.create({
      data: {
        localId,
        userId: params.userId,
        discountType: params.rewardType,
        discountValue: params.rewardValue ?? null,
        serviceId: params.rewardServiceId ?? null,
        isActive: true,
        maxUses: 1,
        usedCount: 0,
      },
    });
    await client.rewardTransaction.create({
      data: {
        localId,
        userId: params.userId,
        referralAttributionId: params.referralAttributionId,
        couponId: coupon.id,
        type: RewardTxType.COUPON_ISSUED,
        status: RewardTxStatus.CONFIRMED,
        description: params.description,
      },
    });
  }

  async voidReferralRewards(referralAttributionId: string, reason: string, tx?: Prisma.TransactionClient) {
    const localId = getCurrentLocalId();
    const client = this.getClient(tx);
    const transactions = await client.rewardTransaction.findMany({
      where: { localId, referralAttributionId, status: RewardTxStatus.CONFIRMED },
    });
    for (const entry of transactions) {
      if (entry.type === RewardTxType.CREDIT && entry.amount) {
        const amount = Number(entry.amount);
        if (amount > 0) {
          const wallet = await this.ensureWallet(entry.userId, entry.localId, tx);
          await client.rewardWallet.update({
            where: { id: wallet.id },
            data: { balance: { decrement: amount } },
          });
          await client.rewardTransaction.create({
            data: {
              localId: entry.localId,
              userId: entry.userId,
              referralAttributionId,
              type: RewardTxType.ADJUSTMENT,
              status: RewardTxStatus.CONFIRMED,
              amount: new Prisma.Decimal(-amount),
              description: reason,
            },
          });
        }
      }
      if (entry.type === RewardTxType.COUPON_ISSUED && entry.couponId) {
        await client.coupon.update({
          where: { id: entry.couponId },
          data: { isActive: false },
        });
        await client.rewardTransaction.create({
          data: {
            localId: entry.localId,
            userId: entry.userId,
            referralAttributionId,
            couponId: entry.couponId,
            type: RewardTxType.ADJUSTMENT,
            status: RewardTxStatus.CONFIRMED,
            description: reason,
          },
        });
      }
    }
  }
}
