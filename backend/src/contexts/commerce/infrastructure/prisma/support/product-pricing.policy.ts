import { DiscountType, OfferScope, OfferTarget } from '@prisma/client';
import { isOfferActiveNow } from './offer-active.policy';

type ProductShape = {
  id: string;
  categoryId?: string | null;
  price: number | { toString(): string };
};

type ProductOfferShape = {
  id: string;
  name: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number | { toString(): string };
  scope: OfferScope;
  target: OfferTarget;
  startDate: Date | null;
  endDate: Date | null;
  active: boolean;
  productCategories: Array<{ id: string }>;
  products: Array<{ id: string }>;
};

const appliesToProduct = (offer: ProductOfferShape, product: ProductShape): boolean => {
  if (offer.target !== OfferTarget.product) return false;

  switch (offer.scope) {
    case OfferScope.all:
      return true;
    case OfferScope.categories:
      return Boolean(product.categoryId) && offer.productCategories.some((cat) => cat.id === product.categoryId);
    case OfferScope.products:
      return offer.products.some((item) => item.id === product.id);
    default:
      return false;
  }
};

const calculateFinalPrice = (basePrice: number, offer: ProductOfferShape): number => {
  if (offer.discountType === DiscountType.percentage) {
    const factor = Math.max(0, 1 - Number(offer.discountValue) / 100);
    return basePrice * factor;
  }
  return Math.max(0, basePrice - Number(offer.discountValue));
};

export const computeProductPricing = (
  product: ProductShape,
  offers: ProductOfferShape[],
  referenceDate: Date = new Date(),
) => {
  const basePrice = Number(product.price);
  let finalPrice = basePrice;
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

  for (const offer of offers) {
    if (!isOfferActiveNow(offer, referenceDate)) continue;
    if (!appliesToProduct(offer, product)) continue;

    const priceAfter = calculateFinalPrice(basePrice, offer);
    if (priceAfter < finalPrice) {
      finalPrice = priceAfter;
      appliedOfferData = {
        id: offer.id,
        name: offer.name,
        description: offer.description ?? '',
        discountType: offer.discountType,
        discountValue: Number(offer.discountValue),
        scope: offer.scope,
        startDate: offer.startDate,
        endDate: offer.endDate,
        amountOff: basePrice - priceAfter,
      };
    }
  }

  return {
    basePrice,
    finalPrice,
    appliedOffer: appliedOfferData,
  };
};
