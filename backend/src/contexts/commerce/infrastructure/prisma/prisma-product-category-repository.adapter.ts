import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ProductCategoryEntity } from '../../domain/entities/product-category.entity';
import {
  CreateProductCategoryInput,
  ProductCategoryRepositoryPort,
  UpdateProductCategoryInput,
} from '../../ports/outbound/product-category-repository.port';
import { areProductCategoriesEnabled } from './support/commerce-settings.policy';

const mapProductCategoryEntity = (category: {
  id: string;
  localId: string;
  name: string;
  description: string | null;
  position: number;
  products?: unknown[];
}): ProductCategoryEntity => ({
  id: category.id,
  localId: category.localId,
  name: category.name,
  description: category.description ?? '',
  position: category.position,
  products: category.products,
});

@Injectable()
export class PrismaProductCategoryRepositoryAdapter implements ProductCategoryRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listByLocalId(params: { localId: string; withProducts: boolean }): Promise<ProductCategoryEntity[]> {
    const categories = await this.prisma.productCategory.findMany({
      where: { localId: params.localId },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: params.withProducts
        ? {
            products: {
              where: { isArchived: false },
              orderBy: { name: 'asc' },
              include: { category: true },
            },
          }
        : undefined,
    });

    return categories.map(mapProductCategoryEntity);
  }

  async findByIdAndLocalId(params: {
    id: string;
    localId: string;
    withProducts: boolean;
  }): Promise<ProductCategoryEntity | null> {
    const category = await this.prisma.productCategory.findFirst({
      where: { id: params.id, localId: params.localId },
      include: params.withProducts
        ? {
            products: {
              where: { isArchived: false },
              orderBy: { name: 'asc' },
              include: { category: true },
            },
          }
        : undefined,
    });
    return category ? mapProductCategoryEntity(category) : null;
  }

  async create(input: CreateProductCategoryInput): Promise<ProductCategoryEntity> {
    const created = await this.prisma.productCategory.create({
      data: {
        localId: input.localId,
        name: input.name,
        description: input.description,
        position: input.position,
      },
    });
    return mapProductCategoryEntity(created);
  }

  async updateById(id: string, input: UpdateProductCategoryInput): Promise<ProductCategoryEntity> {
    const updated = await this.prisma.productCategory.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description ?? input.description,
        position: input.position,
      },
    });
    return mapProductCategoryEntity(updated);
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.productCategory.delete({ where: { id } });
  }

  countAssignedProducts(params: { localId: string; categoryId: string }): Promise<number> {
    return this.prisma.product.count({
      where: { categoryId: params.categoryId, localId: params.localId, isArchived: false },
    });
  }

  areCategoriesEnabled(params: { localId: string; brandId: string }): Promise<boolean> {
    return areProductCategoriesEnabled(this.prisma, {
      localId: params.localId,
      brandId: params.brandId,
    });
  }
}
