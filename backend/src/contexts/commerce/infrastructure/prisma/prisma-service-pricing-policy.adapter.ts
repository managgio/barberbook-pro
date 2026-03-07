import { Injectable, NotFoundException } from '@nestjs/common';
import { OfferTarget } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { calculateServicePrice, ServicePricingOffer } from '../../domain/services/service-pricing-policy';
import {
  CommerceServicePricingPort,
  CommerceServicePricingResult,
} from '../../ports/outbound/service-pricing.port';

@Injectable()
export class PrismaServicePricingPolicyAdapter implements CommerceServicePricingPort {
  constructor(private readonly prisma: PrismaService) {}

  async calculateServicePrice(params: {
    localId: string;
    serviceId: string;
    referenceDate: Date;
  }): Promise<CommerceServicePricingResult> {
    const service = await this.prisma.service.findFirst({
      where: { id: params.serviceId, localId: params.localId },
      select: {
        id: true,
        name: true,
        price: true,
        categoryId: true,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const offers = await this.prisma.offer.findMany({
      where: {
        active: true,
        localId: params.localId,
        target: OfferTarget.service,
      },
      include: {
        categories: { select: { id: true } },
        services: { select: { id: true } },
      },
    });

    const normalizedOffers = offers.reduce<ServicePricingOffer[]>((acc, offer) => {
        const scope =
          offer.scope === 'categories' ? 'categories' : offer.scope === 'services' ? 'services' : offer.scope === 'all' ? 'all' : null;

        if (!scope) {
          return acc;
        }

        const discountType: ServicePricingOffer['discountType'] = offer.discountType === 'percentage' ? 'percentage' : 'fixed';

        acc.push({
          id: offer.id,
          name: offer.name,
          active: offer.active,
          scope,
          discountType,
          discountValue: Number(offer.discountValue),
          startDate: offer.startDate,
          endDate: offer.endDate,
          categoryIds: offer.categories.map((category) => category.id),
          serviceIds: offer.services.map((item) => item.id),
        });

        return acc;
      }, []);

    return calculateServicePrice({
      service: {
        id: service.id,
        name: service.name,
        price: Number(service.price),
        categoryId: service.categoryId,
      },
      offers: normalizedOffers,
      referenceDate: params.referenceDate,
    });
  }
}
