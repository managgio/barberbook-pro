import { Offer, Product, ProductCategory, Service, ServiceCategory } from '@prisma/client';

type OfferWithRelations = Offer & {
  categories?: ServiceCategory[];
  services?: Service[];
  productCategories?: ProductCategory[];
  products?: Product[];
};

export const mapOffer = (offer: OfferWithRelations) => ({
  id: offer.id,
  name: offer.name,
  description: offer.description ?? '',
  discountType: offer.discountType,
  discountValue: parseFloat(offer.discountValue.toString()),
  scope: offer.scope,
  target: offer.target,
  startDate: offer.startDate,
  endDate: offer.endDate,
  active: offer.active,
  categories: offer.categories?.map((cat) => ({ id: cat.id, name: cat.name })) ?? [],
  services: offer.services?.map((service) => ({ id: service.id, name: service.name })) ?? [],
  productCategories: offer.productCategories?.map((cat) => ({ id: cat.id, name: cat.name })) ?? [],
  products: offer.products?.map((product) => ({ id: product.id, name: product.name })) ?? [],
});
