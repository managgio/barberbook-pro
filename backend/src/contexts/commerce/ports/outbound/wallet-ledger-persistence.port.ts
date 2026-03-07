export const COMMERCE_WALLET_LEDGER_PERSISTENCE_PORT = Symbol('COMMERCE_WALLET_LEDGER_PERSISTENCE_PORT');

export type WalletLedgerCouponRecord = {
  id: string;
  userId: string | null;
  serviceId: string | null;
  discountType: string;
  discountValue: number | null;
  isActive: boolean;
  maxUses: number;
  usedCount: number;
  validFrom: Date | null;
  validTo: Date | null;
};

export interface CommerceWalletLedgerPersistencePort {
  findWallet(params: { localId: string; userId: string; tx?: unknown }): Promise<{ id: string; balance: number } | null>;
  createWallet(params: { localId: string; userId: string; tx?: unknown }): Promise<{ id: string; balance: number }>;
  sumPendingWalletHolds(params: { localId: string; userId: string; tx?: unknown }): Promise<number>;
  findCoupon(params: { localId: string; couponId: string; tx?: unknown }): Promise<WalletLedgerCouponRecord | null>;
  incrementCouponUsedCount(params: { couponId: string; tx?: unknown }): Promise<void>;
  createHoldTransaction(params: {
    localId: string;
    userId: string;
    appointmentId: string;
    amount: number;
    description: string;
    tx?: unknown;
  }): Promise<void>;
  createCouponUsageTransaction(params: {
    localId: string;
    userId: string;
    appointmentId: string;
    couponId: string;
    amount: number;
    description: string;
    tx?: unknown;
  }): Promise<void>;
}
