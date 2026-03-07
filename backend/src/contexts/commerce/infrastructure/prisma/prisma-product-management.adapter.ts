import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  CommerceProductForManagement,
  CommerceProductManagementPort,
  CreateCommerceProductInput,
  ProductSettingsScope,
  UpdateCommerceProductInput,
} from '../../ports/outbound/product-management.port';
import { areProductCategoriesEnabled, getProductSettings } from './support/commerce-settings.policy';

const normalizeName = (value: string): string => value.trim().toLowerCase();

@Injectable()
export class PrismaProductManagementAdapter implements CommerceProductManagementPort {
  constructor(private readonly prisma: PrismaService) {}

  async areProductsEnabled(scope: ProductSettingsScope): Promise<boolean> {
    const settings = await getProductSettings(this.prisma, scope);
    return settings.enabled;
  }

  areCategoriesEnabled(scope: ProductSettingsScope): Promise<boolean> {
    return areProductCategoriesEnabled(this.prisma, scope);
  }

  async categoryExists(params: { localId: string; categoryId: string }): Promise<boolean> {
    const category = await this.prisma.productCategory.findFirst({
      where: { id: params.categoryId, localId: params.localId },
      select: { id: true },
    });
    return Boolean(category);
  }

  async findActiveProductById(params: {
    localId: string;
    productId: string;
  }): Promise<CommerceProductForManagement | null> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: params.productId,
        localId: params.localId,
        isArchived: false,
      },
      select: {
        id: true,
        categoryId: true,
        imageFileId: true,
      },
    });
    if (!product) {
      return null;
    }

    return {
      id: product.id,
      categoryId: product.categoryId,
      imageFileId: product.imageFileId,
    };
  }

  async findActiveProductByNormalizedName(params: {
    localId: string;
    normalizedName: string;
  }): Promise<{ id: string } | null> {
    const candidates = await this.prisma.product.findMany({
      where: { localId: params.localId, isArchived: false },
      select: { id: true, name: true },
    });

    const matched = candidates.find((candidate) => normalizeName(candidate.name) === params.normalizedName) ?? null;
    return matched ? { id: matched.id } : null;
  }

  async createProduct(params: {
    localId: string;
    input: CreateCommerceProductInput;
  }): Promise<{ id: string }> {
    const created = await this.prisma.product.create({
      data: {
        localId: params.localId,
        name: params.input.name,
        description: params.input.description,
        sku: params.input.sku,
        price: params.input.price,
        stock: params.input.stock,
        minStock: params.input.minStock,
        categoryId: params.input.categoryId,
        imageUrl: params.input.imageUrl,
        imageFileId: params.input.imageFileId,
        isActive: params.input.isActive,
        isPublic: params.input.isPublic,
      },
      select: { id: true },
    });
    return { id: created.id };
  }

  async updateProduct(params: {
    localId: string;
    productId: string;
    input: UpdateCommerceProductInput;
  }): Promise<{ id: string } | null> {
    const existing = await this.prisma.product.findFirst({
      where: {
        id: params.productId,
        localId: params.localId,
        isArchived: false,
      },
      select: { id: true },
    });
    if (!existing) {
      return null;
    }

    const updated = await this.prisma.product.update({
      where: { id: params.productId },
      data: {
        name: params.input.name,
        description: params.input.description,
        sku: params.input.sku,
        price: params.input.price,
        stock: params.input.stock,
        minStock: params.input.minStock,
        categoryId: params.input.categoryId,
        imageUrl: params.input.imageUrl,
        imageFileId: params.input.imageFileId,
        isActive: params.input.isActive,
        isPublic: params.input.isPublic,
      },
      select: { id: true },
    });
    return { id: updated.id };
  }

  countAppointmentUsages(productId: string): Promise<number> {
    return this.prisma.appointmentProduct.count({
      where: { productId },
    });
  }

  async archiveProduct(params: { localId: string; productId: string }): Promise<void> {
    await this.prisma.product.update({
      where: { id: params.productId },
      data: {
        isActive: false,
        isPublic: false,
        isArchived: true,
        imageUrl: null,
        imageFileId: null,
      },
    });
  }

  async deleteProduct(params: { localId: string; productId: string }): Promise<void> {
    await this.prisma.product.delete({
      where: { id: params.productId },
    });
  }

  async findLocationsByIds(localIds: string[]): Promise<Array<{ id: string; brandId: string }>> {
    const uniqueIds = [...new Set(localIds)];
    if (uniqueIds.length === 0) return [];

    const locations = await this.prisma.location.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        brandId: true,
      },
    });

    return locations;
  }

  importProducts(params: {
    sourceLocalId: string;
    destinationLocalId: string;
  }): Promise<{ created: number; updated: number }> {
    return this.prisma.$transaction(async (tx) => {
      const [destinationCategories, sourceProducts, destinationProducts] = await Promise.all([
        tx.productCategory.findMany({ where: { localId: params.destinationLocalId } }),
        tx.product.findMany({
          where: { localId: params.sourceLocalId, isArchived: false },
          include: { category: true },
        }),
        tx.product.findMany({ where: { localId: params.destinationLocalId, isArchived: false } }),
      ]);

      const destinationCategoryByName = new Map(
        destinationCategories.map((category) => [normalizeName(category.name), category]),
      );
      const destinationProductByName = new Map(
        destinationProducts.map((product) => [normalizeName(product.name), product]),
      );

      let created = 0;
      let updated = 0;

      for (const sourceProduct of sourceProducts) {
        let destinationCategoryId: string | null = null;
        if (sourceProduct.category) {
          const categoryKey = normalizeName(sourceProduct.category.name);
          let destinationCategory = destinationCategoryByName.get(categoryKey);

          if (!destinationCategory) {
            destinationCategory = await tx.productCategory.create({
              data: {
                localId: params.destinationLocalId,
                name: sourceProduct.category.name,
                description: sourceProduct.category.description ?? '',
                position: sourceProduct.category.position ?? 0,
              },
            });
            destinationCategoryByName.set(categoryKey, destinationCategory);
          } else {
            await tx.productCategory.update({
              where: { id: destinationCategory.id },
              data: {
                description: sourceProduct.category.description ?? '',
                position: sourceProduct.category.position ?? destinationCategory.position,
              },
            });
          }

          destinationCategoryId = destinationCategory.id;
        }

        const productKey = normalizeName(sourceProduct.name);
        const existingDestinationProduct = destinationProductByName.get(productKey);
        const payload = {
          localId: params.destinationLocalId,
          name: sourceProduct.name,
          description: sourceProduct.description ?? '',
          sku: sourceProduct.sku ?? null,
          price: sourceProduct.price,
          stock: sourceProduct.stock,
          minStock: sourceProduct.minStock ?? 0,
          categoryId: destinationCategoryId,
          imageUrl: sourceProduct.imageUrl ?? null,
          imageFileId: sourceProduct.imageFileId ?? null,
          isActive: sourceProduct.isActive,
          isPublic: sourceProduct.isPublic,
        };

        if (existingDestinationProduct) {
          await tx.product.update({
            where: { id: existingDestinationProduct.id },
            data: payload,
          });
          updated += 1;
        } else {
          const createdProduct = await tx.product.create({ data: payload });
          destinationProductByName.set(productKey, createdProduct);
          created += 1;
        }
      }

      return { created, updated };
    });
  }
}
