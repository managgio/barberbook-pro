import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { CreateServiceUseCase } from '@/contexts/commerce/application/use-cases/create-service.use-case';
import { RemoveServiceUseCase } from '@/contexts/commerce/application/use-cases/remove-service.use-case';
import { UpdateServiceUseCase } from '@/contexts/commerce/application/use-cases/update-service.use-case';
import { CommerceServiceReadModel } from '@/contexts/commerce/domain/entities/service-read.entity';
import { CommerceServiceReadPort } from '@/contexts/commerce/ports/outbound/service-read.port';
import { CommerceServiceManagementPort } from '@/contexts/commerce/ports/outbound/service-management.port';
import { DomainError } from '@/shared/domain/domain-error';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: 'user-1',
  timezone: 'Europe/Madrid',
  correlationId: 'corr-commerce-service-management-1',
};

const readModel: CommerceServiceReadModel = {
  id: 'service-1',
  name: 'Corte',
  description: '',
  price: 20,
  duration: 30,
  isArchived: false,
  categoryId: 'category-1',
  category: {
    id: 'category-1',
    name: 'Hair',
    description: '',
    position: 0,
  },
  finalPrice: 20,
  appliedOffer: null,
};

const baseManagementPort = (): CommerceServiceManagementPort => ({
  areCategoriesEnabled: async () => false,
  categoryExists: async () => true,
  findServiceForManagement: async () => ({
    id: 'service-1',
    categoryId: 'category-1',
    isArchived: false,
  }),
  createService: async () => ({ id: 'service-1' }),
  updateService: async () => ({ id: 'service-1' }),
  archiveService: async () => 'archived',
});

const baseReadPort = (): CommerceServiceReadPort => ({
  listServices: async () => [],
  getServiceById: async () => readModel,
});

test('create service blocks when categories are enabled and category is missing', async () => {
  const useCase = new CreateServiceUseCase(
    {
      ...baseManagementPort(),
      areCategoriesEnabled: async () => true,
    },
    baseReadPort(),
  );

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        name: 'Corte',
        price: 20,
        duration: 30,
      }),
    (error: unknown) =>
      error instanceof DomainError && error.code === 'SERVICE_CATEGORY_REQUIRED_WHEN_ENABLED',
  );
});

test('update service keeps existing category when categoryId is undefined', async () => {
  const received: { categoryId?: string | null } = {};
  const useCase = new UpdateServiceUseCase(
    {
      ...baseManagementPort(),
      areCategoriesEnabled: async () => true,
      findServiceForManagement: async () => ({
        id: 'service-1',
        categoryId: 'category-1',
        isArchived: false,
      }),
      updateService: async (params) => {
        received.categoryId = params.input.categoryId;
        return { id: params.serviceId };
      },
    },
    baseReadPort(),
  );

  await useCase.execute({
    context: requestContext,
    serviceId: 'service-1',
    name: 'Corte premium',
  });

  assert.equal(received.categoryId, 'category-1');
});

test('update service throws SERVICE_NOT_FOUND when service does not exist in tenant scope', async () => {
  const useCase = new UpdateServiceUseCase(
    {
      ...baseManagementPort(),
      findServiceForManagement: async () => null,
    },
    baseReadPort(),
  );

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        serviceId: 'missing-service',
        name: 'New name',
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'SERVICE_NOT_FOUND',
  );
});

test('remove service throws SERVICE_NOT_FOUND when service does not exist in tenant scope', async () => {
  const useCase = new RemoveServiceUseCase({
    ...baseManagementPort(),
    archiveService: async () => 'not_found',
  });

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        serviceId: 'missing-service',
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'SERVICE_NOT_FOUND',
  );
});

test('remove service succeeds when already archived', async () => {
  const useCase = new RemoveServiceUseCase({
    ...baseManagementPort(),
    archiveService: async () => 'already_archived',
  });

  const result = await useCase.execute({
    context: requestContext,
    serviceId: 'service-1',
  });

  assert.deepEqual(result, { success: true });
});
