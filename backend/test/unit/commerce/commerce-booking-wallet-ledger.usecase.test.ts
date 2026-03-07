import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  BookingWalletLedgerError,
  BookingWalletLedgerUseCase,
} from '@/contexts/commerce/application/use-cases/booking-wallet-ledger.use-case';

test('getAvailableBalance creates wallet when missing and subtracts pending holds', async () => {
  const calls: string[] = [];
  const persistence = {
    findWallet: async () => null,
    createWallet: async () => {
      calls.push('createWallet');
      return { id: 'wallet-1', balance: 20 };
    },
    sumPendingWalletHolds: async () => 6,
    findCoupon: async () => null,
    incrementCouponUsedCount: async () => undefined,
    createHoldTransaction: async () => undefined,
    createCouponUsageTransaction: async () => undefined,
  } as any;

  const useCase = new BookingWalletLedgerUseCase(persistence);
  const balance = await useCase.getAvailableBalance({ localId: 'local-1', userId: 'user-1' });
  assert.equal(balance, 14);
  assert.deepEqual(calls, ['createWallet']);
});

test('validateCoupon rejects invalid ownership and date windows', async () => {
  const baseCoupon = {
    id: 'coupon-1',
    userId: 'owner-1',
    serviceId: null,
    discountType: 'PERCENT_DISCOUNT',
    discountValue: 20,
    isActive: true,
    maxUses: 1,
    usedCount: 0,
    validFrom: new Date('2026-03-10T00:00:00.000Z'),
    validTo: null,
  };
  const persistence = {
    findWallet: async () => ({ id: 'wallet-1', balance: 20 }),
    createWallet: async () => ({ id: 'wallet-1', balance: 20 }),
    sumPendingWalletHolds: async () => 0,
    findCoupon: async () => baseCoupon,
    incrementCouponUsedCount: async () => undefined,
    createHoldTransaction: async () => undefined,
    createCouponUsageTransaction: async () => undefined,
  } as any;

  const useCase = new BookingWalletLedgerUseCase(persistence);

  await assert.rejects(
    () =>
      useCase.validateCoupon({
        localId: 'local-1',
        userId: 'user-1',
        couponId: 'coupon-1',
        serviceId: 'service-1',
        referenceDate: new Date('2026-03-04T10:00:00.000Z'),
      }),
    (error: unknown) =>
      error instanceof BookingWalletLedgerError &&
      error.code === 'COUPON_NOT_OWNED' &&
      error.message === 'El cupón no pertenece a este usuario.',
  );
});

test('reserveWalletHold skips when amount is non-positive', async () => {
  let called = false;
  const persistence = {
    findWallet: async () => ({ id: 'wallet-1', balance: 20 }),
    createWallet: async () => ({ id: 'wallet-1', balance: 20 }),
    sumPendingWalletHolds: async () => 0,
    findCoupon: async () => null,
    incrementCouponUsedCount: async () => undefined,
    createHoldTransaction: async () => {
      called = true;
    },
    createCouponUsageTransaction: async () => undefined,
  } as any;

  const useCase = new BookingWalletLedgerUseCase(persistence);
  const reserved = await useCase.reserveWalletHold({
    localId: 'local-1',
    userId: 'user-1',
    appointmentId: 'apt-1',
    amount: 0,
    description: 'hold',
  });
  assert.equal(reserved, 0);
  assert.equal(called, false);
});

test('reserveCouponUsage throws not found when coupon does not exist', async () => {
  const persistence = {
    findWallet: async () => ({ id: 'wallet-1', balance: 20 }),
    createWallet: async () => ({ id: 'wallet-1', balance: 20 }),
    sumPendingWalletHolds: async () => 0,
    findCoupon: async () => null,
    incrementCouponUsedCount: async () => undefined,
    createHoldTransaction: async () => undefined,
    createCouponUsageTransaction: async () => undefined,
  } as any;

  const useCase = new BookingWalletLedgerUseCase(persistence);
  await assert.rejects(
    () =>
      useCase.reserveCouponUsage({
        localId: 'local-1',
        userId: 'user-1',
        couponId: 'coupon-1',
        appointmentId: 'apt-1',
        amount: 4,
        description: 'coupon hold',
      }),
    (error: unknown) =>
      error instanceof BookingWalletLedgerError &&
      error.code === 'COUPON_NOT_FOUND' &&
      error.message === 'Cupón no encontrado.',
  );
});
