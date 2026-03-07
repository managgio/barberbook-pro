import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { calculateCouponDiscount } from '../../domain/services/coupon-discount-policy';
import { CommerceWalletLedgerPort, CommerceValidatedCoupon } from '../../ports/outbound/wallet-ledger.port';
import { BookingWalletLedgerError, BookingWalletLedgerUseCase } from '../../application/use-cases/booking-wallet-ledger.use-case';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../../platform/ports/outbound/tenant-context.port';

type CouponDiscountType = Parameters<typeof calculateCouponDiscount>[0]['couponType'];

const isCouponDiscountType = (value: string): value is CouponDiscountType =>
  value === 'FREE_SERVICE' || value === 'PERCENT_DISCOUNT' || value === 'FIXED_DISCOUNT';

@Injectable()
export class PrismaCommerceWalletLedgerAdapter implements CommerceWalletLedgerPort {
  constructor(
    private readonly bookingWalletLedgerUseCase: BookingWalletLedgerUseCase,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  private getLocalId() {
    return this.tenantContextPort.getRequestContext().localId;
  }

  async validateCoupon(params: {
    userId: string;
    couponId: string;
    serviceId: string;
    referenceDate?: Date;
  }): Promise<CommerceValidatedCoupon> {
    try {
      return await this.bookingWalletLedgerUseCase.validateCoupon({
        localId: this.getLocalId(),
        userId: params.userId,
        couponId: params.couponId,
        serviceId: params.serviceId,
        referenceDate: params.referenceDate ?? new Date(),
      });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  calculateCouponDiscount(params: {
    couponType: string;
    couponValue: number | null;
    baseServicePrice: number;
  }): number {
    if (!isCouponDiscountType(params.couponType)) {
      return 0;
    }
    return calculateCouponDiscount({
      couponType: params.couponType,
      couponValue: params.couponValue,
      baseServicePrice: params.baseServicePrice,
    });
  }

  getAvailableBalance(userId: string): Promise<number> {
    return this.bookingWalletLedgerUseCase.getAvailableBalance({
      localId: this.getLocalId(),
      userId,
    });
  }

  reserveWalletHold(
    params: {
      userId: string;
      appointmentId: string;
      amount: number;
      description: string;
    },
    tx?: unknown,
  ): Promise<number> {
    return this.bookingWalletLedgerUseCase.reserveWalletHold({
      localId: this.getLocalId(),
      userId: params.userId,
      appointmentId: params.appointmentId,
      amount: params.amount,
      description: params.description,
      tx,
    });
  }

  async reserveCouponUsage(
    params: {
      userId: string;
      couponId: string;
      appointmentId: string;
      amount: number;
      description: string;
    },
    tx?: unknown,
  ): Promise<void> {
    try {
      await this.bookingWalletLedgerUseCase.reserveCouponUsage({
        localId: this.getLocalId(),
        userId: params.userId,
        couponId: params.couponId,
        appointmentId: params.appointmentId,
        amount: params.amount,
        description: params.description,
        tx,
      });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private mapError(error: unknown) {
    if (!(error instanceof BookingWalletLedgerError)) return error;
    if (error.code === 'COUPON_NOT_FOUND') {
      return new NotFoundException(error.message);
    }
    return new BadRequestException(error.message);
  }
}
