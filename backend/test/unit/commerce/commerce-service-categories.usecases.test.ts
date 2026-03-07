import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { GetServiceCategoryByIdUseCase } from '@/contexts/commerce/application/use-cases/get-service-category-by-id.use-case';
import { RemoveServiceCategoryUseCase } from '@/contexts/commerce/application/use-cases/remove-service-category.use-case';
import { DomainError } from '@/shared/domain/domain-error';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: 'user-1',
  timezone: 'Europe/Madrid',
  correlationId: 'corr-commerce-service-categories-1',
};

test('get service category by id throws CATEGORY_NOT_FOUND when missing', async () => {
  const useCase = new GetServiceCategoryByIdUseCase({
    listByLocalId: async () => [],
    findByIdAndLocalId: async () => null,
    create: async () => {
      throw new Error('not used');
    },
    updateById: async () => {
      throw new Error('not used');
    },
    deleteById: async () => undefined,
    countAssignedServices: async () => 0,
    areCategoriesEnabled: async () => false,
  });

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        categoryId: 'missing-category',
        withServices: true,
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'CATEGORY_NOT_FOUND',
  );
});

test('remove service category blocks delete when categorization enabled and services assigned', async () => {
  const calls: string[] = [];
  const useCase = new RemoveServiceCategoryUseCase({
    listByLocalId: async () => [],
    findByIdAndLocalId: async () => ({
      id: 'category-1',
      localId: 'local-1',
      name: 'Beard',
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
    countAssignedServices: async () => 3,
    areCategoriesEnabled: async () => true,
  });

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        categoryId: 'category-1',
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'CATEGORY_HAS_ASSIGNED_SERVICES',
  );
  assert.deepEqual(calls, []);
});

test('remove service category deletes when categorization disabled', async () => {
  const calls: string[] = [];
  const useCase = new RemoveServiceCategoryUseCase({
    listByLocalId: async () => [],
    findByIdAndLocalId: async () => ({
      id: 'category-1',
      localId: 'local-1',
      name: 'Beard',
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
    countAssignedServices: async () => 2,
    areCategoriesEnabled: async () => false,
  });

  await useCase.execute({
    context: requestContext,
    categoryId: 'category-1',
  });

  assert.deepEqual(calls, ['delete:category-1']);
});

