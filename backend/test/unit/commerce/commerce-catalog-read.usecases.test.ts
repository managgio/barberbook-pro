import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { GetActiveOffersUseCase } from '@/contexts/commerce/application/use-cases/get-active-offers.use-case';
import { GetOffersUseCase } from '@/contexts/commerce/application/use-cases/get-offers.use-case';
import { GetProductsAdminUseCase } from '@/contexts/commerce/application/use-cases/get-products-admin.use-case';
import { GetProductsPublicUseCase } from '@/contexts/commerce/application/use-cases/get-products-public.use-case';
import { GetServiceByIdUseCase } from '@/contexts/commerce/application/use-cases/get-service-by-id.use-case';
import { GetServicesUseCase } from '@/contexts/commerce/application/use-cases/get-services.use-case';
import { DomainError } from '@/shared/domain/domain-error';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: 'user-1',
  timezone: 'Europe/Madrid',
  correlationId: 'corr-commerce-catalog-read-1',
};

test('get services use case forwards localId and includeArchived', async () => {
  const received: { params?: unknown } = {};
  const useCase = new GetServicesUseCase({
    listServices: async (params) => {
      received.params = params;
      return [];
    },
    getServiceById: async () => null,
  });

  await useCase.execute({
    context: requestContext,
    includeArchived: true,
  });

  assert.deepEqual(received.params, {
    localId: 'local-1',
    includeArchived: true,
  });
});

test('get service by id use case throws SERVICE_NOT_FOUND when repository misses target', async () => {
  const useCase = new GetServiceByIdUseCase({
    listServices: async () => [],
    getServiceById: async () => null,
  });

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        serviceId: 'missing',
        includeArchived: false,
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'SERVICE_NOT_FOUND',
  );
});

test('get products admin use case forwards brand/local scope', async () => {
  const received: { params?: unknown } = {};
  const useCase = new GetProductsAdminUseCase({
    listAdminProducts: async (params) => {
      received.params = params;
      return [];
    },
    listPublicProducts: async () => [],
    getProductById: async () => null,
  });

  await useCase.execute({
    context: requestContext,
  });

  assert.deepEqual(received.params, {
    localId: 'local-1',
    brandId: 'brand-1',
  });
});

test('get products public use case forwards context view and scope', async () => {
  const received: { params?: unknown } = {};
  const useCase = new GetProductsPublicUseCase({
    listAdminProducts: async () => [],
    listPublicProducts: async (params) => {
      received.params = params;
      return [];
    },
    getProductById: async () => null,
  });

  await useCase.execute({
    context: requestContext,
    contextView: 'booking',
  });

  assert.deepEqual(received.params, {
    localId: 'local-1',
    brandId: 'brand-1',
    context: 'booking',
  });
});

test('get offers use case forwards local scope and target filter', async () => {
  const received: { params?: unknown } = {};
  const useCase = new GetOffersUseCase({
    listOffers: async (params) => {
      received.params = params;
      return [];
    },
    listActiveOffers: async () => [],
    getOfferById: async () => null,
  });

  await useCase.execute({
    context: requestContext,
    target: 'product',
  });

  assert.deepEqual(received.params, {
    localId: 'local-1',
    target: 'product',
  });
});

test('get active offers use case injects now when omitted', async () => {
  const useCase = new GetActiveOffersUseCase({
    listOffers: async () => [],
    listActiveOffers: async (params) => {
      assert.equal(params.localId, 'local-1');
      assert.equal(params.target, 'service');
      assert.ok(params.now instanceof Date);
      return [];
    },
    getOfferById: async () => null,
  });

  await useCase.execute({
    context: requestContext,
    target: 'service',
  });
});
