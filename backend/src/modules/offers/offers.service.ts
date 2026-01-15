import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { mapOffer } from './offers.mapper';
import { OfferScope } from '@prisma/client';

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  private validateScope(dto: CreateOfferDto | UpdateOfferDto) {
    if (dto.scope === OfferScope.categories && (!dto.categoryIds || dto.categoryIds.length === 0)) {
      throw new BadRequestException('Selecciona al menos una categoría para esta oferta.');
    }
    if (dto.scope === OfferScope.services && (!dto.serviceIds || dto.serviceIds.length === 0)) {
      throw new BadRequestException('Selecciona al menos un servicio para esta oferta.');
    }
    if (dto.startDate && dto.endDate && new Date(dto.startDate) > new Date(dto.endDate)) {
      throw new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin.');
    }
  }

  async findAll() {
    const localId = getCurrentLocalId();
    const offers = await this.prisma.offer.findMany({
      where: { localId },
      orderBy: { createdAt: 'desc' },
      include: { categories: true, services: true },
    });
    return offers.map(mapOffer);
  }

  async findActive() {
    const now = new Date();
    const localId = getCurrentLocalId();
    const offers = await this.prisma.offer.findMany({
      where: {
        localId,
        active: true,
        OR: [
          { startDate: null },
          { startDate: { lte: now } },
        ],
        AND: [
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      include: { categories: true, services: true },
    });
    return offers.map(mapOffer);
  }

  async create(data: CreateOfferDto) {
    this.validateScope(data);
    const localId = getCurrentLocalId();
    const created = await this.prisma.offer.create({
      data: {
        localId,
        name: data.name,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        scope: data.scope,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        active: data.active ?? true,
        categories:
          data.scope === OfferScope.categories && data.categoryIds
            ? { connect: data.categoryIds.map((id) => ({ id })) }
            : undefined,
        services:
          data.scope === OfferScope.services && data.serviceIds
            ? { connect: data.serviceIds.map((id) => ({ id })) }
            : undefined,
      },
      include: { categories: true, services: true },
    });
    return mapOffer(created);
  }

  async update(id: string, data: UpdateOfferDto) {
    this.validateScope(data);
    const localId = getCurrentLocalId();
    const existing = await this.prisma.offer.findFirst({ where: { id, localId } });
    if (!existing) throw new NotFoundException('Offer not found');

    const updated = await this.prisma.offer.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        scope: data.scope,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        active: data.active,
        categories:
          data.scope === OfferScope.categories
            ? {
                set: data.categoryIds?.map((id) => ({ id })) ?? [],
              }
            : data.scope === undefined
            ? undefined
            : { set: [] },
        services:
          data.scope === OfferScope.services
            ? {
                set: data.serviceIds?.map((id) => ({ id })) ?? [],
              }
            : data.scope === undefined
            ? undefined
            : { set: [] },
      },
      include: { categories: true, services: true },
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
