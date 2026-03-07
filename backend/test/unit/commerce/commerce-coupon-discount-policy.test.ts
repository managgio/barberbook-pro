import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { calculateCouponDiscount } from '@/contexts/commerce/domain/services/coupon-discount-policy';

test('coupon discount policy returns full base for FREE_SERVICE', () => {
  const discount = calculateCouponDiscount({
    couponType: 'FREE_SERVICE',
    couponValue: null,
    baseServicePrice: 25,
  });
  assert.equal(discount, 25);
});

test('coupon discount policy applies percentage with cap at base price', () => {
  assert.equal(
    calculateCouponDiscount({
      couponType: 'PERCENT_DISCOUNT',
      couponValue: 20,
      baseServicePrice: 30,
    }),
    6,
  );
  assert.equal(
    calculateCouponDiscount({
      couponType: 'PERCENT_DISCOUNT',
      couponValue: 200,
      baseServicePrice: 30,
    }),
    30,
  );
});

test('coupon discount policy applies fixed amount with cap at base price', () => {
  assert.equal(
    calculateCouponDiscount({
      couponType: 'FIXED_DISCOUNT',
      couponValue: 8,
      baseServicePrice: 30,
    }),
    8,
  );
  assert.equal(
    calculateCouponDiscount({
      couponType: 'FIXED_DISCOUNT',
      couponValue: 80,
      baseServicePrice: 30,
    }),
    30,
  );
});
