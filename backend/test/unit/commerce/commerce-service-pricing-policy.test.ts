import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { calculateServicePrice } from '@/contexts/commerce/domain/services/service-pricing-policy';

const service = {
  id: 'service-1',
  name: 'Corte',
  price: 30,
  categoryId: 'cat-1',
};

test('keeps base price when no active offer applies', () => {
  const result = calculateServicePrice({
    service,
    offers: [],
    referenceDate: new Date('2026-03-04T10:00:00.000Z'),
  });

  assert.equal(result.basePrice, 30);
  assert.equal(result.finalPrice, 30);
  assert.equal(result.appliedOfferId, null);
});

test('applies best offer among applicable offers', () => {
  const result = calculateServicePrice({
    service,
    offers: [
      {
        id: 'offer-1',
        name: '10%',
        active: true,
        scope: 'all',
        discountType: 'percentage',
        discountValue: 10,
        categoryIds: [],
        serviceIds: [],
      },
      {
        id: 'offer-2',
        name: '8 EUR',
        active: true,
        scope: 'services',
        discountType: 'fixed',
        discountValue: 8,
        categoryIds: [],
        serviceIds: ['service-1'],
      },
    ],
    referenceDate: new Date('2026-03-04T10:00:00.000Z'),
  });

  assert.equal(result.finalPrice, 22);
  assert.equal(result.appliedOfferId, 'offer-2');
});

test('ignores non-applicable scope and inactive date window', () => {
  const result = calculateServicePrice({
    service,
    offers: [
      {
        id: 'offer-cat-miss',
        name: 'cat miss',
        active: true,
        scope: 'categories',
        discountType: 'fixed',
        discountValue: 20,
        categoryIds: ['cat-x'],
        serviceIds: [],
      },
      {
        id: 'offer-expired',
        name: 'expired',
        active: true,
        scope: 'all',
        discountType: 'fixed',
        discountValue: 20,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-01-10T00:00:00.000Z'),
        categoryIds: [],
        serviceIds: [],
      },
      {
        id: 'offer-valid-category',
        name: 'category',
        active: true,
        scope: 'categories',
        discountType: 'fixed',
        discountValue: 5,
        categoryIds: ['cat-1'],
        serviceIds: [],
      },
    ],
    referenceDate: new Date('2026-03-04T10:00:00.000Z'),
  });

  assert.equal(result.finalPrice, 25);
  assert.equal(result.appliedOfferId, 'offer-valid-category');
});
