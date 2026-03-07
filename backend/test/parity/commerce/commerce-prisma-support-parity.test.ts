import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeProductPricing as legacyComputeProductPricing } from '@/modules/products/products.pricing';
import {
  areProductCategoriesEnabled as legacyAreProductCategoriesEnabled,
  getProductSettings as legacyGetProductSettings,
} from '@/modules/products/products.utils';
import {
  areServiceCategoriesEnabled as legacyAreServiceCategoriesEnabled,
  isBarberServiceAssignmentEnabled as legacyIsBarberServiceAssignmentEnabled,
} from '@/modules/services/services.utils';
import {
  computeServicePricing as legacyComputeServicePricing,
  isOfferActiveNow as legacyIsOfferActiveNow,
} from '@/modules/services/services.pricing';
import {
  areProductCategoriesEnabled,
  areServiceCategoriesEnabled,
  getProductSettings,
} from '@/contexts/commerce/infrastructure/prisma/support/commerce-settings.policy';
import { isOfferActiveNow } from '@/contexts/commerce/infrastructure/prisma/support/offer-active.policy';
import { computeProductPricing } from '@/contexts/commerce/infrastructure/prisma/support/product-pricing.policy';
import { computeServicePricing } from '@/contexts/commerce/infrastructure/prisma/support/service-pricing.policy';

test('service pricing support helper matches legacy pricing helper', () => {
  const service = { id: 'service-1', categoryId: 'cat-1', price: 30 };
  const offers = [
    {
      id: 'offer-1',
      name: '10%',
      description: null,
      discountType: 'percentage',
      discountValue: 10,
      scope: 'all',
      target: 'service',
      startDate: null,
      endDate: null,
      active: true,
      categories: [],
      services: [],
    },
    {
      id: 'offer-2',
      name: '5€',
      description: null,
      discountType: 'amount',
      discountValue: 5,
      scope: 'categories',
      target: 'service',
      startDate: null,
      endDate: null,
      active: true,
      categories: [{ id: 'cat-1' }],
      services: [],
    },
  ];

  const legacy = legacyComputeServicePricing(service as any, offers as any, new Date('2026-03-04T12:00:00.000Z'));
  const current = computeServicePricing(service as any, offers as any, new Date('2026-03-04T12:00:00.000Z'));

  assert.deepEqual(current, legacy);
});

test('product pricing support helper matches legacy pricing helper', () => {
  const product = { id: 'product-1', categoryId: 'cat-1', price: 20 };
  const offers = [
    {
      id: 'offer-1',
      name: '10%',
      description: null,
      discountType: 'percentage',
      discountValue: 10,
      scope: 'all',
      target: 'product',
      startDate: null,
      endDate: null,
      active: true,
      productCategories: [],
      products: [],
    },
    {
      id: 'offer-2',
      name: '3€',
      description: null,
      discountType: 'amount',
      discountValue: 3,
      scope: 'categories',
      target: 'product',
      startDate: null,
      endDate: null,
      active: true,
      productCategories: [{ id: 'cat-1' }],
      products: [],
    },
  ];

  const legacy = legacyComputeProductPricing(product as any, offers as any, new Date('2026-03-04T12:00:00.000Z'));
  const current = computeProductPricing(product as any, offers as any, new Date('2026-03-04T12:00:00.000Z'));

  assert.deepEqual(current, legacy);
});

test('offer active helper keeps legacy date-window semantics', () => {
  const offer = {
    active: true,
    startDate: new Date('2026-03-04T00:00:00.000Z'),
    endDate: new Date('2026-03-04T00:00:00.000Z'),
  };

  const referenceInsideWindow = new Date('2026-03-04T23:00:00.000Z');
  const referenceAfterWindow = new Date('2026-03-05T00:00:00.000Z');

  assert.equal(isOfferActiveNow(offer as any, referenceInsideWindow), legacyIsOfferActiveNow(offer as any, referenceInsideWindow));
  assert.equal(isOfferActiveNow(offer as any, referenceAfterWindow), legacyIsOfferActiveNow(offer as any, referenceAfterWindow));
});

test('settings support helper matches legacy helpers for service/product flags', async () => {
  const fakePrisma = {
    siteSettings: {
      findUnique: async ({ where }: any) => ({
        localId: where.localId,
        data: {
          services: {
            categoriesEnabled: true,
            barberServiceAssignmentEnabled: true,
          },
          products: {
            enabled: false,
            categoriesEnabled: true,
            clientPurchaseEnabled: true,
            showOnLanding: false,
          },
        },
      }),
    },
    brandConfig: {
      findUnique: async () => ({
        data: {
          adminSidebar: { hiddenSections: [] },
        },
      }),
    },
    locationConfig: {
      findUnique: async () => ({
        data: {
          adminSidebar: { hiddenSections: ['stock'] },
        },
      }),
    },
  };

  const scope = { localId: 'local-1', brandId: 'brand-1' };

  const currentServiceCategories = await areServiceCategoriesEnabled(fakePrisma as any, scope.localId);
  const legacyServiceCategories = await legacyAreServiceCategoriesEnabled(fakePrisma as any, scope.localId);
  assert.equal(currentServiceCategories, legacyServiceCategories);

  const currentProductSettings = await getProductSettings(fakePrisma as any, scope);
  const legacyProductSettings = await legacyGetProductSettings(fakePrisma as any, scope);
  assert.deepEqual(currentProductSettings, legacyProductSettings);

  const currentProductCategories = await areProductCategoriesEnabled(fakePrisma as any, scope);
  const legacyProductCategories = await legacyAreProductCategoriesEnabled(fakePrisma as any, scope);
  assert.equal(currentProductCategories, legacyProductCategories);

  const legacyBarberAssignment = await legacyIsBarberServiceAssignmentEnabled(fakePrisma as any, scope.localId);
  assert.equal(legacyBarberAssignment, true);
});
