import { DiscountType, OfferScope, OfferTarget } from '@prisma/client';
import { isOfferActiveNow } from './offer-active.policy';

type ServiceCategoryShape = { id: string };
type ServiceShape = { id: string; categoryId?: string | null; price: number | { toString(): string } };

type ServiceOfferShape = {
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
  categories: ServiceCategoryShape[];
  services: Array<{ id: string }>;
};

const appliesToService = (offer: ServiceOfferShape, service: ServiceShape): boolean => {
  if (offer.target !== OfferTarget.service) return false;

  switch (offer.scope) {
    case OfferScope.all:
      return true;
    case OfferScope.categories:
      return Boolean(service.categoryId) && offer.categories.some((category) => category.id === service.categoryId);
    case OfferScope.services:
      return offer.services.some((candidate) => candidate.id === service.id);
    default:
      return false;
  }
};

const calculateFinalPrice = (basePrice: number, offer: ServiceOfferShape): number => {
  if (offer.discountType === DiscountType.percentage) {
    const factor = Math.max(0, 1 - Number(offer.discountValue) / 100);
    return basePrice * factor;
  }
  return Math.max(0, basePrice - Number(offer.discountValue));
};

export const computeServicePricing = (
  service: ServiceShape,
  offers: ServiceOfferShape[],
  referenceDate: Date = new Date(),
) => {
  const basePrice = Number(service.price);
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
    if (!appliesToService(offer, service)) continue;

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
