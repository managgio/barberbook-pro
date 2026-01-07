import { Offer, Service, ServiceCategory } from '@prisma/client';

type OfferWithRelations = Offer & { categories?: ServiceCategory[]; services?: Service[] };

export const mapOffer = (offer: OfferWithRelations) => ({
  id: offer.id,
  name: offer.name,
  description: offer.description ?? '',
  discountType: offer.discountType,
  discountValue: parseFloat(offer.discountValue.toString()),
  scope: offer.scope,
  startDate: offer.startDate,
  endDate: offer.endDate,
  active: offer.active,
  categories: offer.categories?.map((cat) => ({ id: cat.id, name: cat.name })) ?? [],
  services: offer.services?.map((service) => ({ id: service.id, name: service.name })) ?? [],
});
