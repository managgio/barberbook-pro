type OfferWithRelations = {
  id: string;
  name: string;
  description: string | null;
  discountType: string;
  discountValue: number | { toString(): string };
  scope: string;
  target: string;
  startDate: Date | null;
  endDate: Date | null;
  active: boolean;
  categories?: Array<{ id: string; name: string }>;
  services?: Array<{ id: string; name: string }>;
  productCategories?: Array<{ id: string; name: string }>;
  products?: Array<{ id: string; name: string }>;
};

export const mapOffer = (offer: OfferWithRelations) => ({
  id: offer.id,
  name: offer.name,
  description: offer.description ?? '',
  discountType: offer.discountType,
  discountValue: Number(offer.discountValue),
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
