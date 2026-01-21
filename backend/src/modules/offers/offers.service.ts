import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { mapOffer } from './offers.mapper';
import { OfferScope, OfferTarget } from '@prisma/client';

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  private validateScope(dto: CreateOfferDto | UpdateOfferDto, target?: OfferTarget) {
    const resolvedTarget = target ?? dto.target ?? OfferTarget.service;
    if (dto.scope === OfferScope.categories) {
      if (resolvedTarget === OfferTarget.service && (!dto.categoryIds || dto.categoryIds.length === 0)) {
        throw new BadRequestException('Selecciona al menos una categoría para esta oferta.');
      }
      if (resolvedTarget === OfferTarget.product && (!dto.productCategoryIds || dto.productCategoryIds.length === 0)) {
        throw new BadRequestException('Selecciona al menos una categoría de productos para esta oferta.');
      }
    }
    if (dto.scope === OfferScope.services) {
      if (resolvedTarget === OfferTarget.product) {
        throw new BadRequestException('Las ofertas de productos no pueden usar el alcance de servicios.');
      }
      if (!dto.serviceIds || dto.serviceIds.length === 0) {
        throw new BadRequestException('Selecciona al menos un servicio para esta oferta.');
      }
    }
    if (dto.scope === OfferScope.products) {
      if (resolvedTarget === OfferTarget.service) {
        throw new BadRequestException('Las ofertas de servicios no pueden usar el alcance de productos.');
      }
      if (!dto.productIds || dto.productIds.length === 0) {
        throw new BadRequestException('Selecciona al menos un producto para esta oferta.');
      }
    }
    if (dto.startDate && dto.endDate && new Date(dto.startDate) > new Date(dto.endDate)) {
      throw new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin.');
    }
  }

  async findAll(target?: OfferTarget) {
    const localId = getCurrentLocalId();
    const offers = await this.prisma.offer.findMany({
      where: { localId, ...(target ? { target } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { categories: true, services: true, productCategories: true, products: true },
    });
    return offers.map(mapOffer);
  }

  async findActive(target?: OfferTarget) {
    const now = new Date();
    const localId = getCurrentLocalId();
    const offers = await this.prisma.offer.findMany({
      where: {
        localId,
        ...(target ? { target } : {}),
        active: true,
        OR: [
          { startDate: null },
          { startDate: { lte: now } },
        ],
        AND: [
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      include: { categories: true, services: true, productCategories: true, products: true },
    });
    return offers.map(mapOffer);
  }

  async create(data: CreateOfferDto) {
    const target = data.target ?? OfferTarget.service;
    this.validateScope(data, target);
    const localId = getCurrentLocalId();
    const created = await this.prisma.offer.create({
      data: {
        localId,
        name: data.name,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        scope: data.scope,
        target,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        active: data.active ?? true,
        categories:
          target === OfferTarget.service && data.scope === OfferScope.categories && data.categoryIds
            ? { connect: data.categoryIds.map((id) => ({ id })) }
            : undefined,
        services:
          target === OfferTarget.service && data.scope === OfferScope.services && data.serviceIds
            ? { connect: data.serviceIds.map((id) => ({ id })) }
            : undefined,
        productCategories:
          target === OfferTarget.product && data.scope === OfferScope.categories && data.productCategoryIds
            ? { connect: data.productCategoryIds.map((id) => ({ id })) }
            : undefined,
        products:
          target === OfferTarget.product && data.scope === OfferScope.products && data.productIds
            ? { connect: data.productIds.map((id) => ({ id })) }
            : undefined,
      },
      include: { categories: true, services: true, productCategories: true, products: true },
    });
    return mapOffer(created);
  }

  async update(id: string, data: UpdateOfferDto) {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.offer.findFirst({ where: { id, localId } });
    if (!existing) throw new NotFoundException('Offer not found');
    const target = data.target ?? existing.target;
    const scope = data.scope ?? existing.scope;
    if (target === OfferTarget.product && scope === OfferScope.services) {
      throw new BadRequestException('Las ofertas de productos no pueden usar el alcance de servicios.');
    }
    if (target === OfferTarget.service && scope === OfferScope.products) {
      throw new BadRequestException('Las ofertas de servicios no pueden usar el alcance de productos.');
    }
    this.validateScope(data, target);

    const updated = await this.prisma.offer.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        scope: data.scope,
        target: data.target,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        active: data.active,
        categories:
          target === OfferTarget.service && scope === OfferScope.categories
            ? {
                set: data.categoryIds?.map((id) => ({ id })) ?? [],
              }
            : data.scope === undefined && data.target === undefined
            ? undefined
            : { set: [] },
        services:
          target === OfferTarget.service && scope === OfferScope.services
            ? {
                set: data.serviceIds?.map((id) => ({ id })) ?? [],
              }
            : data.scope === undefined && data.target === undefined
            ? undefined
            : { set: [] },
        productCategories:
          target === OfferTarget.product && scope === OfferScope.categories
            ? {
                set: data.productCategoryIds?.map((id) => ({ id })) ?? [],
              }
            : data.scope === undefined && data.target === undefined
            ? undefined
            : { set: [] },
        products:
          target === OfferTarget.product && scope === OfferScope.products
            ? {
                set: data.productIds?.map((id) => ({ id })) ?? [],
              }
            : data.scope === undefined && data.target === undefined
            ? undefined
            : { set: [] },
      },
      include: { categories: true, services: true, productCategories: true, products: true },
    });
    return mapOffer(updated);
  }

  async remove(id: string) {
    const localId = getCurrentLocalId();
    const existing = await this.prisma.offer.findFirst({ where: { id, localId } });
    if (!existing) throw new NotFoundException('Offer not found');
    await this.prisma.offer.delete({ where: { id } });
    return { success: true };
  }
}
