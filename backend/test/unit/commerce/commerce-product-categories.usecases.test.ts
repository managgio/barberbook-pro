import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { GetProductCategoryByIdUseCase } from '@/contexts/commerce/application/use-cases/get-product-category-by-id.use-case';
import { RemoveProductCategoryUseCase } from '@/contexts/commerce/application/use-cases/remove-product-category.use-case';
import { DomainError } from '@/shared/domain/domain-error';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: 'user-1',
  timezone: 'Europe/Madrid',
  correlationId: 'corr-commerce-product-categories-1',
};

test('get product category by id throws PRODUCT_CATEGORY_NOT_FOUND when missing', async () => {
  const useCase = new GetProductCategoryByIdUseCase({
    listByLocalId: async () => [],
    findByIdAndLocalId: async () => null,
    create: async () => {
      throw new Error('not used');
    },
    updateById: async () => {
      throw new Error('not used');
    },
    deleteById: async () => undefined,
    countAssignedProducts: async () => 0,
    areCategoriesEnabled: async () => false,
  });

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        categoryId: 'missing-category',
        withProducts: true,
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'PRODUCT_CATEGORY_NOT_FOUND',
  );
});

test('remove product category blocks delete when categorization enabled and products assigned', async () => {
  const calls: string[] = [];
  const useCase = new RemoveProductCategoryUseCase({
    listByLocalId: async () => [],
    findByIdAndLocalId: async () => ({
      id: 'category-1',
      localId: 'local-1',
      name: 'Hair care',
      description: '',
      position: 0,
    }),
    create: async () => {
      throw new Error('not used');
    },
    updateById: async () => {
      throw new Error('not used');
    },
    deleteById: async (id) => {
      calls.push(`delete:${id}`);
    },
    countAssignedProducts: async () => 2,
    areCategoriesEnabled: async () => true,
  });

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        categoryId: 'category-1',
      }),
    (error: unknown) =>
      error instanceof DomainError && error.code === 'PRODUCT_CATEGORY_HAS_ASSIGNED_PRODUCTS',
  );
  assert.deepEqual(calls, []);
});

test('remove product category deletes when categorization disabled', async () => {
  const calls: string[] = [];
  const useCase = new RemoveProductCategoryUseCase({
    listByLocalId: async () => [],
    findByIdAndLocalId: async () => ({
      id: 'category-1',
      localId: 'local-1',
      name: 'Hair care',
      description: '',
      position: 0,
    }),
    create: async () => {
      throw new Error('not used');
    },
    updateById: async () => {
      throw new Error('not used');
    },
    deleteById: async (id) => {
      calls.push(`delete:${id}`);
    },
    countAssignedProducts: async () => 4,
    areCategoriesEnabled: async () => false,
  });

  await useCase.execute({
    context: requestContext,
    categoryId: 'category-1',
  });

  assert.deepEqual(calls, ['delete:category-1']);
});

