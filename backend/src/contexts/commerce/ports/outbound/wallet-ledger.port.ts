export const COMMERCE_WALLET_LEDGER_PORT = Symbol('COMMERCE_WALLET_LEDGER_PORT');

export type CommerceValidatedCoupon = {
  id: string;
  discountType: string;
  discountValue: number | null;
};

export interface CommerceWalletLedgerPort {
  validateCoupon(params: {
    userId: string;
    couponId: string;
    serviceId: string;
    referenceDate?: Date;
  }): Promise<CommerceValidatedCoupon>;
  calculateCouponDiscount(params: {
    couponType: string;
    couponValue: number | null;
    baseServicePrice: number;
  }): number;
  getAvailableBalance(userId: string): Promise<number>;
  reserveWalletHold(
    params: {
      userId: string;
      appointmentId: string;
      amount: number;
      description: string;
    },
    tx?: unknown,
  ): Promise<number>;
  reserveCouponUsage(
    params: {
      userId: string;
      couponId: string;
      appointmentId: string;
      amount: number;
      description: string;
    },
    tx?: unknown,
  ): Promise<void>;
}
