import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { mapService } from './services.mapper';
import { areServiceCategoriesEnabled } from './services.utils';
import { computeServicePricing, isOfferActiveNow } from './services.pricing';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const localId = getCurrentLocalId();
    const [services, offers] = await Promise.all([
      this.prisma.service.findMany({
        where: { localId },
        orderBy: { name: 'asc' },
        include: { category: true },
      }),
      this.prisma.offer.findMany({
        where: { active: true, localId, target: 'service' },
        include: { categories: true, services: true },
      }),
    ]);

    const activeOffers = offers.filter((offer) => isOfferActiveNow(offer));
    return services.map((service) => mapService(service, computeServicePricing(service, activeOffers)));
  }

  async findOne(id: string) {
    const localId = getCurrentLocalId();
    const [service, offers] = await Promise.all([
      this.prisma.service.findFirst({
        where: { id, localId },
        include: { category: true },
      }),
      this.prisma.offer.findMany({
        where: { active: true, localId, target: 'service' },
        include: { categories: true, services: true },
      }),
    ]);
    if (!service) throw new NotFoundException('Service not found');
    return mapService(service, computeServicePricing(service, offers.filter((offer) => isOfferActiveNow(offer))));
  }

  private async assertCategoryExists(categoryId: string) {
    const localId = getCurrentLocalId();
    const category = await this.prisma.serviceCategory.findFirst({
      where: { id: categoryId, localId },
    });
    if (!category) throw new NotFoundException('Category not found');
  }

  private async resolveCategoryId(id: string, incomingCategoryId: string | null | undefined) {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.service.findFirst({ where: { id, localId } });
    if (!existing) throw new NotFoundException('Service not found');
    return incomingCategoryId === undefined ? existing.categoryId : incomingCategoryId;
  }

  async create(data: CreateServiceDto) {
    const localId = getCurrentLocalId();
    const categoriesEnabled = await areServiceCategoriesEnabled(this.prisma);
    const categoryId = data.categoryId ?? null;

    if (categoriesEnabled && !categoryId) {
      throw new BadRequestException('Debes asignar una categoría porque la categorización está activada.');
    }

    if (categoryId) {
      await this.assertCategoryExists(categoryId);
    }

    const [created, offers] = await Promise.all([
      this.prisma.service.create({
        data: {
          localId,
          name: data.name,
          description: data.description || '',
          price: data.price,
          duration: data.duration,
          categoryId,
        },
        include: { category: true },
      }),
      this.prisma.offer.findMany({
        where: { active: true, localId, target: 'service' },
        include: { categories: true, services: true },
      }),
    ]);
    return mapService(created, computeServicePricing(created, offers.filter((offer) => isOfferActiveNow(offer))));
  }

  async update(id: string, data: UpdateServiceDto) {
    const localId = getCurrentLocalId();
    const categoriesEnabled = await areServiceCategoriesEnabled(this.prisma);
    const categoryId = await this.resolveCategoryId(id, data.categoryId);

    if (categoriesEnabled && !categoryId) {
      throw new BadRequestException('Todos los servicios deben tener categoría mientras la función esté activa.');
    }

    if (categoryId) {
      await this.assertCategoryExists(categoryId);
    }

    const [updated, offers] = await Promise.all([
      this.prisma.service.update({
        where: { id },
        data: { ...data, categoryId: categoryId ?? null },
        include: { category: true },
      }),
      this.prisma.offer.findMany({
        where: { active: true, localId, target: 'service' },
        include: { categories: true, services: true },
      }),
    ]);
    return mapService(updated, computeServicePricing(updated, offers.filter((offer) => isOfferActiveNow(offer))));
  }

  async remove(id: string) {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.service.findFirst({ where: { id, localId } });
    if (!existing) throw new NotFoundException('Service not found');
    await this.prisma.service.delete({ where: { id } });
    return { success: true };
  }
}
