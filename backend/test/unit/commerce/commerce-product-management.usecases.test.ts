import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { CreateProductUseCase } from '@/contexts/commerce/application/use-cases/create-product.use-case';
import { ImportProductsUseCase } from '@/contexts/commerce/application/use-cases/import-products.use-case';
import { RemoveProductUseCase } from '@/contexts/commerce/application/use-cases/remove-product.use-case';
import { UpdateProductUseCase } from '@/contexts/commerce/application/use-cases/update-product.use-case';
import { CommerceProductReadModel } from '@/contexts/commerce/domain/entities/product-read.entity';
import { CommerceProductManagementPort } from '@/contexts/commerce/ports/outbound/product-management.port';
import { CommerceProductMediaStoragePort } from '@/contexts/commerce/ports/outbound/product-media-storage.port';
import { CommerceProductReadPort } from '@/contexts/commerce/ports/outbound/product-read.port';
import { DomainError } from '@/shared/domain/domain-error';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: 'user-1',
  timezone: 'Europe/Madrid',
  correlationId: 'corr-commerce-product-management-1',
};

const readModel: CommerceProductReadModel = {
  id: 'product-1',
  name: 'Pomada',
  description: '',
  sku: 'SKU-1',
  price: 10,
  stock: 4,
  minStock: 1,
  imageUrl: null,
  imageFileId: null,
  isActive: true,
  isPublic: true,
  categoryId: 'category-1',
  category: {
    id: 'category-1',
    name: 'Hair care',
    description: '',
    position: 0,
  },
  finalPrice: 10,
  appliedOffer: null,
};

const baseReadPort = (): CommerceProductReadPort => ({
  listAdminProducts: async () => [],
  listPublicProducts: async () => [],
  getProductById: async () => readModel,
});

const baseManagementPort = (): CommerceProductManagementPort => ({
  areProductsEnabled: async () => true,
  areCategoriesEnabled: async () => false,
  categoryExists: async () => true,
  findActiveProductById: async () => ({
    id: 'product-1',
    categoryId: 'category-1',
    imageFileId: null,
  }),
  findActiveProductByNormalizedName: async () => null,
  createProduct: async () => ({ id: 'product-1' }),
  updateProduct: async () => ({ id: 'product-1' }),
  countAppointmentUsages: async () => 0,
  archiveProduct: async () => undefined,
  deleteProduct: async () => undefined,
  findLocationsByIds: async () => [
    { id: 'source-local', brandId: 'brand-1' },
    { id: 'target-local', brandId: 'brand-1' },
  ],
  importProducts: async () => ({ created: 1, updated: 2 }),
});

test('create product throws PRODUCTS_MODULE_DISABLED when module is disabled', async () => {
  const useCase = new CreateProductUseCase(
    {
      ...baseManagementPort(),
      areProductsEnabled: async () => false,
    },
    baseReadPort(),
  );

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        name: 'Pomada',
        price: 10,
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'PRODUCTS_MODULE_DISABLED',
  );
});

test('create product enforces category when categories are enabled', async () => {
  const useCase = new CreateProductUseCase(
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
        name: 'Pomada',
        price: 10,
      }),
    (error: unknown) =>
      error instanceof DomainError && error.code === 'PRODUCT_CATEGORY_REQUIRED_WHEN_ENABLED',
  );
});

test('update product keeps existing category when categoryId is undefined', async () => {
  const received: { categoryId?: string | null } = {};
  const useCase = new UpdateProductUseCase(
    {
      ...baseManagementPort(),
      areCategoriesEnabled: async () => true,
      findActiveProductById: async () => ({
        id: 'product-1',
        categoryId: 'category-1',
        imageFileId: null,
      }),
      updateProduct: async (params) => {
        received.categoryId = params.input.categoryId;
        return { id: params.productId };
      },
    },
    baseReadPort(),
  );

  await useCase.execute({
    context: requestContext,
    productId: 'product-1',
    name: 'Pomada Pro',
  });

  assert.equal(received.categoryId, 'category-1');
});

test('remove product archives when product is linked to appointments', async () => {
  const calls: string[] = [];
  const useCase = new RemoveProductUseCase(
    {
      ...baseManagementPort(),
      findActiveProductById: async () => ({
        id: 'product-1',
        categoryId: 'category-1',
        imageFileId: 'file-1',
      }),
      countAppointmentUsages: async () => 3,
      archiveProduct: async () => {
        calls.push('archive');
      },
      deleteProduct: async () => {
        calls.push('delete');
      },
    },
    {
      deleteImageFile: async () => {
        calls.push('delete-image');
      },
    },
  );

  const result = await useCase.execute({
    context: requestContext,
    productId: 'product-1',
  });

  assert.deepEqual(result, { success: true, archived: true });
  assert.deepEqual(calls, ['delete-image', 'archive']);
});

test('remove product throws PRODUCT_NOT_FOUND when outside scope', async () => {
  const mediaPort: CommerceProductMediaStoragePort = {
    deleteImageFile: async () => undefined,
  };
  const useCase = new RemoveProductUseCase(
    {
      ...baseManagementPort(),
      findActiveProductById: async () => null,
    },
    mediaPort,
  );

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        productId: 'missing-product',
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'PRODUCT_NOT_FOUND',
  );
});

test('import products rejects cross-brand import', async () => {
  const useCase = new ImportProductsUseCase({
    ...baseManagementPort(),
    findLocationsByIds: async () => [
      { id: 'source-local', brandId: 'brand-1' },
      { id: 'target-local', brandId: 'brand-2' },
    ],
  });

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        sourceLocalId: 'source-local',
        targetLocalId: 'target-local',
      }),
    (error: unknown) =>
      error instanceof DomainError && error.code === 'PRODUCT_IMPORT_CROSS_BRAND_FORBIDDEN',
  );
});
