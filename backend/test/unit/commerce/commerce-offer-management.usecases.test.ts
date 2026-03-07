import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { CreateOfferUseCase } from '@/contexts/commerce/application/use-cases/create-offer.use-case';
import { RemoveOfferUseCase } from '@/contexts/commerce/application/use-cases/remove-offer.use-case';
import { UpdateOfferUseCase } from '@/contexts/commerce/application/use-cases/update-offer.use-case';
import { CommerceOfferReadPort } from '@/contexts/commerce/ports/outbound/offer-read.port';
import { CommerceOfferManagementPort } from '@/contexts/commerce/ports/outbound/offer-management.port';
import { DomainError } from '@/shared/domain/domain-error';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: 'user-1',
  timezone: 'Europe/Madrid',
  correlationId: 'corr-commerce-offer-management-1',
};

const baseReadPort = (): CommerceOfferReadPort => ({
  listOffers: async () => [],
  listActiveOffers: async () => [],
  getOfferById: async () => ({
    id: 'offer-1',
    name: 'Promo',
    description: '',
    discountType: 'percentage',
    discountValue: 10,
    scope: 'all',
    target: 'service',
    startDate: null,
    endDate: null,
    active: true,
    categories: [],
    services: [],
    productCategories: [],
    products: [],
  }),
});

const baseManagementPort = (): CommerceOfferManagementPort => ({
  createOffer: async () => ({ id: 'offer-1' }),
  findOfferForUpdate: async () => ({
    id: 'offer-1',
    scope: 'all',
    target: 'service',
  }),
  updateOffer: async () => ({ id: 'offer-1' }),
  deleteOffer: async () => true,
});

test('create offer requires categoryIds for service target + categories scope', async () => {
  const useCase = new CreateOfferUseCase(baseManagementPort(), baseReadPort());

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        name: 'Promo',
        discountType: 'percentage',
        discountValue: 10,
        scope: 'categories',
        target: 'service',
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'OFFER_SERVICE_CATEGORY_IDS_REQUIRED',
  );
});

test('create offer rejects services scope for product target', async () => {
  const useCase = new CreateOfferUseCase(baseManagementPort(), baseReadPort());

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        name: 'Promo',
        discountType: 'percentage',
        discountValue: 10,
        scope: 'services',
        target: 'product',
        serviceIds: ['service-1'],
      }),
    (error: unknown) =>
      error instanceof DomainError && error.code === 'OFFER_PRODUCT_TARGET_INVALID_SERVICE_SCOPE',
  );
});

test('update offer throws OFFER_NOT_FOUND when outside tenant scope', async () => {
  const useCase = new UpdateOfferUseCase(
    {
      ...baseManagementPort(),
      findOfferForUpdate: async () => null,
    },
    baseReadPort(),
  );

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        offerId: 'missing-offer',
        name: 'New promo',
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'OFFER_NOT_FOUND',
  );
});

test('update offer validates date range', async () => {
  const useCase = new UpdateOfferUseCase(baseManagementPort(), baseReadPort());

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        offerId: 'offer-1',
        startDate: '2026-03-10T10:00:00.000Z',
        endDate: '2026-03-01T10:00:00.000Z',
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'OFFER_INVALID_DATE_RANGE',
  );
});

test('remove offer returns success when repository deletes row', async () => {
  const useCase = new RemoveOfferUseCase(baseManagementPort());

  const result = await useCase.execute({
    context: requestContext,
    offerId: 'offer-1',
  });

  assert.deepEqual(result, { success: true });
});

test('remove offer throws OFFER_NOT_FOUND when repository misses row', async () => {
  const useCase = new RemoveOfferUseCase({
    ...baseManagementPort(),
    deleteOffer: async () => false,
  });

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        offerId: 'missing-offer',
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'OFFER_NOT_FOUND',
  );
});
