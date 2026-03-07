import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  CreateServiceCategoryInput,
  ServiceCategoryRepositoryPort,
  UpdateServiceCategoryInput,
} from '../../ports/outbound/service-category-repository.port';
import { ServiceCategoryEntity, ServiceCategoryServiceItemEntity } from '../../domain/entities/service-category.entity';
import { areServiceCategoriesEnabled } from './support/commerce-settings.policy';

const mapServiceItem = (service: {
  id: string;
  name: string;
  description: string;
  price: unknown;
  duration: number;
  isArchived: boolean;
  categoryId: string | null;
  category?: {
    id: string;
    name: string;
    description: string | null;
    position: number;
  } | null;
}): ServiceCategoryServiceItemEntity => ({
  id: service.id,
  name: service.name,
  description: service.description,
  price: Number(service.price),
  duration: service.duration,
  isArchived: service.isArchived,
  categoryId: service.categoryId,
  category: service.category
    ? {
        id: service.category.id,
        name: service.category.name,
        description: service.category.description ?? '',
        position: service.category.position,
      }
    : null,
});

const mapCategoryEntity = (category: {
  id: string;
  localId: string;
  name: string;
  description: string | null;
  position: number;
  services?: Array<{
    id: string;
    name: string;
    description: string;
    price: unknown;
    duration: number;
    isArchived: boolean;
    categoryId: string | null;
    category?: {
      id: string;
      name: string;
      description: string | null;
      position: number;
    } | null;
  }>;
}): ServiceCategoryEntity => ({
  id: category.id,
  localId: category.localId,
  name: category.name,
  description: category.description ?? '',
  position: category.position,
  services: category.services?.map(mapServiceItem),
});

@Injectable()
export class PrismaServiceCategoryRepositoryAdapter implements ServiceCategoryRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listByLocalId(params: { localId: string; withServices: boolean }): Promise<ServiceCategoryEntity[]> {
    const categories = await this.prisma.serviceCategory.findMany({
      where: { localId: params.localId },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: params.withServices
        ? { services: { orderBy: { name: 'asc' }, include: { category: true } } }
        : undefined,
    });
    return categories.map(mapCategoryEntity);
  }

  async findByIdAndLocalId(params: {
    id: string;
    localId: string;
    withServices: boolean;
  }): Promise<ServiceCategoryEntity | null> {
    const category = await this.prisma.serviceCategory.findFirst({
      where: { id: params.id, localId: params.localId },
      include: params.withServices
        ? { services: { orderBy: { name: 'asc' }, include: { category: true } } }
        : undefined,
    });
    return category ? mapCategoryEntity(category) : null;
  }

  async create(input: CreateServiceCategoryInput): Promise<ServiceCategoryEntity> {
    const created = await this.prisma.serviceCategory.create({
      data: {
        localId: input.localId,
        name: input.name,
        description: input.description,
        position: input.position,
      },
    });
    return mapCategoryEntity(created);
  }

  async updateById(id: string, input: UpdateServiceCategoryInput): Promise<ServiceCategoryEntity> {
    const updated = await this.prisma.serviceCategory.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description ?? input.description,
        position: input.position,
      },
    });
    return mapCategoryEntity(updated);
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.serviceCategory.delete({
      where: { id },
    });
  }

  countAssignedServices(params: { localId: string; categoryId: string }): Promise<number> {
    return this.prisma.service.count({
      where: { categoryId: params.categoryId, localId: params.localId },
    });
  }

  areCategoriesEnabled(localId: string): Promise<boolean> {
    return areServiceCategoriesEnabled(this.prisma, localId);
  }
}
