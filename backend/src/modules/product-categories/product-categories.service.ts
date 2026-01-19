import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { mapProductCategory } from './product-categories.mapper';
import { areProductCategoriesEnabled } from '../products/products.utils';

@Injectable()
export class ProductCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(withProducts = true) {
    const localId = getCurrentLocalId();
    const categories = await this.prisma.productCategory.findMany({
      where: { localId },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: withProducts
        ? { products: { orderBy: { name: 'asc' }, include: { category: true } } }
        : undefined,
    });
    return categories.map((category) => mapProductCategory(category, { includeProducts: withProducts }));
  }

  async findOne(id: string, withProducts = true) {
    const localId = getCurrentLocalId();
    const category = await this.prisma.productCategory.findFirst({
      where: { id, localId },
      include: withProducts
        ? { products: { orderBy: { name: 'asc' }, include: { category: true } } }
        : undefined,
    });
    if (!category) throw new NotFoundException('Category not found');
    return mapProductCategory(category, { includeProducts: withProducts });
  }

  async create(data: CreateProductCategoryDto) {
    const localId = getCurrentLocalId();
    const created = await this.prisma.productCategory.create({
      data: {
        localId,
        name: data.name,
        description: data.description ?? '',
        position: data.position ?? 0,
      },
    });
    return mapProductCategory(created, { includeProducts: false });
  }

  async update(id: string, data: UpdateProductCategoryDto) {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.productCategory.findFirst({ where: { id, localId } });
    if (!existing) throw new NotFoundException('Category not found');

    const updated = await this.prisma.productCategory.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description ?? data.description,
        position: data.position,
      },
    });
    return mapProductCategory(updated, { includeProducts: false });
  }

  async remove(id: string) {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.productCategory.findFirst({ where: { id, localId } });
    if (!existing) throw new NotFoundException('Category not found');
    const categoriesEnabled = await areProductCategoriesEnabled(this.prisma);
    const assignedProducts = await this.prisma.product.count({
      where: { categoryId: id, localId },
    });

    if (categoriesEnabled && assignedProducts > 0) {
      throw new BadRequestException(
        'No puedes eliminar esta categoría mientras haya productos asignados y la categorización esté activa.',
      );
    }

    await this.prisma.productCategory.delete({ where: { id } });
    return { success: true };
  }
}
