export type CouponDiscountType = 'FREE_SERVICE' | 'PERCENT_DISCOUNT' | 'FIXED_DISCOUNT';

export const calculateCouponDiscount = (params: {
  couponType: CouponDiscountType;
  couponValue: number | null;
  baseServicePrice: number;
}): number => {
  const base = Math.max(0, params.baseServicePrice);
  if (base <= 0) return 0;
  if (params.couponType === 'FREE_SERVICE') return base;
  if (params.couponType === 'PERCENT_DISCOUNT') {
    const value = Math.max(0, Number(params.couponValue ?? 0));
    return Math.min(base, base * (value / 100));
  }
  const value = Math.max(0, Number(params.couponValue ?? 0));
  return Math.min(base, value);
};
