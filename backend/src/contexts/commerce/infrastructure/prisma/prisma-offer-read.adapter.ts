import { Injectable } from '@nestjs/common';
import { OfferTarget } from '@prisma/client';
import { CommerceOfferReadModel, CommerceOfferTarget } from '../../domain/entities/offer-read.entity';
import { CommerceOfferReadPort } from '../../ports/outbound/offer-read.port';
import { PrismaService } from '../../../../prisma/prisma.service';

type OfferRow = {
  id: string;
  name: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  scope: string;
  target: string;
  startDate: Date | null;
  endDate: Date | null;
  active: boolean;
  categories: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string }>;
  productCategories: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string }>;
};

const mapOffer = (offer: OfferRow): CommerceOfferReadModel => ({
  id: offer.id,
  name: offer.name,
  description: offer.description ?? '',
  discountType: offer.discountType,
  discountValue: Number(offer.discountValue),
  scope: offer.scope,
  target: offer.target as CommerceOfferTarget,
  startDate: offer.startDate,
  endDate: offer.endDate,
  active: offer.active,
  categories: offer.categories.map((cat) => ({ id: cat.id, name: cat.name })),
  services: offer.services.map((service) => ({ id: service.id, name: service.name })),
  productCategories: offer.productCategories.map((cat) => ({ id: cat.id, name: cat.name })),
  products: offer.products.map((product) => ({ id: product.id, name: product.name })),
});

@Injectable()
export class PrismaOfferReadAdapter implements CommerceOfferReadPort {
  constructor(private readonly prisma: PrismaService) {}

  async listOffers(params: {
    localId: string;
    target?: CommerceOfferTarget;
  }): Promise<CommerceOfferReadModel[]> {
    const offers = await this.prisma.offer.findMany({
      where: {
        localId: params.localId,
        ...(params.target ? { target: params.target as OfferTarget } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { categories: true, services: true, productCategories: true, products: true },
    });

    return offers.map((offer) => mapOffer(offer as unknown as OfferRow));
  }

  async listActiveOffers(params: {
    localId: string;
    target?: CommerceOfferTarget;
    now: Date;
  }): Promise<CommerceOfferReadModel[]> {
    const offers = await this.prisma.offer.findMany({
      where: {
        localId: params.localId,
        ...(params.target ? { target: params.target as OfferTarget } : {}),
        active: true,
        OR: [{ startDate: null }, { startDate: { lte: params.now } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: params.now } }] }],
      },
      include: { categories: true, services: true, productCategories: true, products: true },
    });

    return offers.map((offer) => mapOffer(offer as unknown as OfferRow));
  }

  async getOfferById(params: {
    localId: string;
    offerId: string;
  }): Promise<CommerceOfferReadModel | null> {
    const offer = await this.prisma.offer.findFirst({
      where: {
        id: params.offerId,
        localId: params.localId,
      },
      include: { categories: true, services: true, productCategories: true, products: true },
    });

    if (!offer) {
      return null;
    }

    return mapOffer(offer as unknown as OfferRow);
  }
}
