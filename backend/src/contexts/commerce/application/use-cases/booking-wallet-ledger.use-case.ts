import { CommerceValidatedCoupon } from '../../ports/outbound/wallet-ledger.port';
import { CommerceWalletLedgerPersistencePort } from '../../ports/outbound/wallet-ledger-persistence.port';

export class BookingWalletLedgerError extends Error {
  constructor(
    public readonly code:
      | 'COUPON_NOT_FOUND'
      | 'COUPON_INACTIVE'
      | 'COUPON_INVALID_TYPE'
      | 'COUPON_NOT_OWNED'
      | 'COUPON_NOT_YET_VALID'
      | 'COUPON_EXPIRED'
      | 'COUPON_ALREADY_USED'
      | 'COUPON_NOT_APPLICABLE',
    message: string,
  ) {
    super(message);
  }
}

export class BookingWalletLedgerUseCase {
  constructor(private readonly persistence: CommerceWalletLedgerPersistencePort) {}

  private async ensureWallet(localId: string, userId: string, tx?: unknown) {
    const existing = await this.persistence.findWallet({ localId, userId, tx });
    if (existing) return existing;
    return this.persistence.createWallet({ localId, userId, tx });
  }

  async getAvailableBalance(params: { localId: string; userId: string; tx?: unknown }): Promise<number> {
    const wallet = await this.ensureWallet(params.localId, params.userId, params.tx);
    const pendingHolds = await this.persistence.sumPendingWalletHolds({
      localId: params.localId,
      userId: params.userId,
      tx: params.tx,
    });
    return Math.max(0, wallet.balance - pendingHolds);
  }

  async validateCoupon(params: {
    localId: string;
    userId: string;
    couponId: string;
    serviceId: string;
    referenceDate: Date;
    tx?: unknown;
  }): Promise<CommerceValidatedCoupon> {
    const coupon = await this.persistence.findCoupon({
      localId: params.localId,
      couponId: params.couponId,
      tx: params.tx,
    });
    if (!coupon) {
      throw new BookingWalletLedgerError('COUPON_NOT_FOUND', 'Cupón no encontrado.');
    }
    if (!coupon.isActive) {
      throw new BookingWalletLedgerError('COUPON_INACTIVE', 'El cupón no está activo.');
    }
    if (coupon.discountType === 'WALLET') {
      throw new BookingWalletLedgerError('COUPON_INVALID_TYPE', 'Tipo de cupón no válido.');
    }
    if (coupon.userId && coupon.userId !== params.userId) {
      throw new BookingWalletLedgerError('COUPON_NOT_OWNED', 'El cupón no pertenece a este usuario.');
    }
    if (coupon.validFrom && params.referenceDate < coupon.validFrom) {
      throw new BookingWalletLedgerError('COUPON_NOT_YET_VALID', 'El cupón aún no es válido.');
    }
    if (coupon.validTo && params.referenceDate > coupon.validTo) {
      throw new BookingWalletLedgerError('COUPON_EXPIRED', 'El cupón ha caducado.');
    }
    if (coupon.usedCount >= coupon.maxUses) {
      throw new BookingWalletLedgerError('COUPON_ALREADY_USED', 'El cupón ya se ha utilizado.');
    }
    if (coupon.serviceId && coupon.serviceId !== params.serviceId) {
      throw new BookingWalletLedgerError('COUPON_NOT_APPLICABLE', 'El cupón no aplica a este servicio.');
    }
    return {
      id: coupon.id,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    };
  }

  async reserveWalletHold(params: {
    localId: string;
    userId: string;
    appointmentId: string;
    amount: number;
    description: string;
    tx?: unknown;
  }): Promise<number> {
    if (params.amount <= 0) return 0;
    await this.ensureWallet(params.localId, params.userId, params.tx);
    await this.persistence.createHoldTransaction(params);
    return params.amount;
  }

  async reserveCouponUsage(params: {
    localId: string;
    userId: string;
    couponId: string;
    appointmentId: string;
    amount: number;
    description: string;
    tx?: unknown;
  }): Promise<void> {
    const coupon = await this.persistence.findCoupon({
      localId: params.localId,
      couponId: params.couponId,
      tx: params.tx,
    });
    if (!coupon) {
      throw new BookingWalletLedgerError('COUPON_NOT_FOUND', 'Cupón no encontrado.');
    }
    await this.persistence.incrementCouponUsedCount({ couponId: params.couponId, tx: params.tx });
    await this.persistence.createCouponUsageTransaction(params);
  }
}
