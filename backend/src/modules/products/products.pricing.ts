import { DiscountType, Offer, OfferScope, OfferTarget, Product, ProductCategory } from '@prisma/client';
import { isOfferActiveNow } from '../services/services.pricing';

type OfferWithRelations = Offer & { productCategories: ProductCategory[]; products: Product[] };
type ProductWithCategory = Product & { categoryId?: string | null };

const appliesToProduct = (offer: OfferWithRelations, product: ProductWithCategory) => {
  if (offer.target !== OfferTarget.product) return false;
  switch (offer.scope) {
    case OfferScope.all:
      return true;
    case OfferScope.categories:
      return !!product.categoryId && offer.productCategories.some((cat) => cat.id === product.categoryId);
    case OfferScope.products:
      return offer.products.some((item) => item.id === product.id);
    default:
      return false;
  }
};

const calculateFinalPrice = (basePrice: number, offer: OfferWithRelations) => {
  if (offer.discountType === DiscountType.percentage) {
    const factor = Math.max(0, 1 - Number(offer.discountValue) / 100);
    return basePrice * factor;
  }
  return Math.max(0, basePrice - Number(offer.discountValue));
};

export const computeProductPricing = (
  product: ProductWithCategory,
  offers: OfferWithRelations[],
  referenceDate: Date = new Date(),
) => {
  const basePrice = Number(product.price);
  let finalPrice = basePrice;
  let appliedOffer: OfferWithRelations | null = null;

  offers.forEach((offer) => {
    if (!isOfferActiveNow(offer, referenceDate)) return;
    if (!appliesToProduct(offer, product)) return;
    const priceAfter = calculateFinalPrice(basePrice, offer);
    if (priceAfter < finalPrice) {
      finalPrice = priceAfter;
      appliedOffer = offer;
    }
  });

  let appliedOfferData: {
    id: string;
    name: string;
    description: string;
    discountType: DiscountType;
    discountValue: number;
    scope: OfferScope;
    startDate: Date | null;
    endDate: Date | null;
    amountOff: number;
  } | null = null;

  if (appliedOffer) {
    const offer = appliedOffer as OfferWithRelations;
    appliedOfferData = {
      id: offer.id,
      name: offer.name,
      description: offer.description ?? '',
      discountType: offer.discountType,
      discountValue: Number(offer.discountValue),
      scope: offer.scope,
      startDate: offer.startDate,
      endDate: offer.endDate,
      amountOff: basePrice - finalPrice,
    };
  }

  return {
    basePrice,
    finalPrice,
    appliedOffer: appliedOfferData,
  };
};
