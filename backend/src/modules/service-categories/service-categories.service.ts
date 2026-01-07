import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { mapServiceCategory } from './service-categories.mapper';
import { areServiceCategoriesEnabled } from '../services/services.utils';

@Injectable()
export class ServiceCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(withServices = true) {
    const categories = await this.prisma.serviceCategory.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: withServices
        ? { services: { orderBy: { name: 'asc' }, include: { category: true } } }
        : undefined,
    });
    return categories.map((category) => mapServiceCategory(category, { includeServices: withServices }));
  }

  async findOne(id: string, withServices = true) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
      include: withServices
        ? { services: { orderBy: { name: 'asc' }, include: { category: true } } }
        : undefined,
    });
    if (!category) throw new NotFoundException('Category not found');
    return mapServiceCategory(category, { includeServices: withServices });
  }

  async create(data: CreateServiceCategoryDto) {
    const created = await this.prisma.serviceCategory.create({
      data: {
        name: data.name,
        description: data.description ?? '',
        position: data.position ?? 0,
      },
    });
    return mapServiceCategory(created, { includeServices: false });
  }

  async update(id: string, data: UpdateServiceCategoryDto) {
    try {
      const updated = await this.prisma.serviceCategory.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description ?? data.description,
          position: data.position,
        },
      });
      return mapServiceCategory(updated, { includeServices: false });
    } catch (error) {
      throw new NotFoundException('Category not found');
    }
  }

  async remove(id: string) {
    const categoriesEnabled = await areServiceCategoriesEnabled(this.prisma);
    const assignedServices = await this.prisma.service.count({ where: { categoryId: id } });

    if (categoriesEnabled && assignedServices > 0) {
      throw new BadRequestException(
        'No puedes eliminar esta categoría mientras haya servicios asignados y la categorización esté activa.',
      );
    }

    await this.prisma.serviceCategory.delete({ where: { id } });
    return { success: true };
  }
}
