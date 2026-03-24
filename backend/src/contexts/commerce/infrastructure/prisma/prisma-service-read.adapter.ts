import { Injectable } from '@nestjs/common';
import { OfferTarget } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CommerceServiceReadModel } from '../../domain/entities/service-read.entity';
import { CommerceServiceReadPort } from '../../ports/outbound/service-read.port';
import { isOfferActiveNow } from './support/offer-active.policy';
import { computeServicePricing } from './support/service-pricing.policy';

type ServiceRow = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  position: number;
  isArchived: boolean;
  categoryId: string | null;
  category: {
    id: string;
    name: string;
    description: string | null;
    position: number;
  } | null;
};

@Injectable()
export class PrismaServiceReadAdapter implements CommerceServiceReadPort {
  constructor(private readonly prisma: PrismaService) {}

  private toReadModel(
    service: ServiceRow,
    pricing: ReturnType<typeof computeServicePricing>,
  ): CommerceServiceReadModel {
    return {
      id: service.id,
      name: service.name,
      description: service.description,
      price: Number(service.price),
      duration: service.duration,
      position: service.position,
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
      finalPrice: pricing.finalPrice,
      appliedOffer: pricing.appliedOffer
        ? {
            ...pricing.appliedOffer,
            amountOff: Number(pricing.appliedOffer.amountOff),
          }
        : null,
    };
  }

  async listServices(params: { localId: string; includeArchived: boolean }): Promise<CommerceServiceReadModel[]> {
    const where = params.includeArchived
      ? { localId: params.localId }
      : { localId: params.localId, isArchived: false };

    const [services, offers] = await Promise.all([
      this.prisma.service.findMany({
        where,
        orderBy: [{ category: { position: 'asc' } }, { position: 'asc' }, { name: 'asc' }],
        include: { category: true },
      }),
      this.prisma.offer.findMany({
        where: { active: true, localId: params.localId, target: OfferTarget.service },
        include: { categories: true, services: true },
      }),
    ]);

    const activeOffers = offers.filter((offer) => isOfferActiveNow(offer));
    return services.map((service) =>
      this.toReadModel(
        service as unknown as ServiceRow,
        computeServicePricing(service as any, activeOffers as any),
      ),
    );
  }

  async getServiceById(params: {
    localId: string;
    serviceId: string;
    includeArchived: boolean;
  }): Promise<CommerceServiceReadModel | null> {
    const where = params.includeArchived
      ? { id: params.serviceId, localId: params.localId }
      : { id: params.serviceId, localId: params.localId, isArchived: false };

    const [service, offers] = await Promise.all([
      this.prisma.service.findFirst({
        where,
        include: { category: true },
      }),
      this.prisma.offer.findMany({
        where: { active: true, localId: params.localId, target: OfferTarget.service },
        include: { categories: true, services: true },
      }),
    ]);

    if (!service) return null;

    const activeOffers = offers.filter((offer) => isOfferActiveNow(offer));
    return this.toReadModel(
      service as unknown as ServiceRow,
      computeServicePricing(service as any, activeOffers as any),
    );
  }
}
