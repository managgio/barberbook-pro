export type ServicePricingScope = 'all' | 'categories' | 'services';
export type ServicePricingDiscountType = 'percentage' | 'fixed';

export type ServicePricingService = {
  id: string;
  name: string;
  price: number;
  categoryId?: string | null;
};

export type ServicePricingOffer = {
  id: string;
  name: string;
  active: boolean;
  scope: ServicePricingScope;
  discountType: ServicePricingDiscountType;
  discountValue: number;
  startDate?: Date | null;
  endDate?: Date | null;
  categoryIds: string[];
  serviceIds: string[];
};

export type ServicePricingResult = {
  serviceName: string;
  basePrice: number;
  finalPrice: number;
  appliedOfferId: string | null;
};

const isOfferActiveNow = (offer: ServicePricingOffer, referenceDate: Date): boolean => {
  if (!offer.active) return false;

  if (offer.startDate) {
    const start = new Date(offer.startDate);
    start.setHours(0, 0, 0, 0);
    if (referenceDate < start) return false;
  }

  if (offer.endDate) {
    const end = new Date(offer.endDate);
    end.setHours(23, 59, 59, 999);
    if (referenceDate > end) return false;
  }

  return true;
};

const appliesToService = (offer: ServicePricingOffer, service: ServicePricingService): boolean => {
  switch (offer.scope) {
    case 'all':
      return true;
    case 'categories':
      return Boolean(service.categoryId) && offer.categoryIds.includes(service.categoryId as string);
    case 'services':
      return offer.serviceIds.includes(service.id);
    default:
      return false;
  }
};

const calculatePriceAfterOffer = (basePrice: number, offer: ServicePricingOffer): number => {
  if (offer.discountType === 'percentage') {
    const factor = Math.max(0, 1 - offer.discountValue / 100);
    return basePrice * factor;
  }
  return Math.max(0, basePrice - offer.discountValue);
};

export const calculateServicePrice = (params: {
  service: ServicePricingService;
  offers: ServicePricingOffer[];
  referenceDate: Date;
}): ServicePricingResult => {
  const { service, offers, referenceDate } = params;
  const basePrice = Number(service.price);
  let finalPrice = basePrice;
  let appliedOfferId: string | null = null;

  offers.forEach((offer) => {
    if (!isOfferActiveNow(offer, referenceDate)) return;
    if (!appliesToService(offer, service)) return;

    const candidatePrice = calculatePriceAfterOffer(basePrice, offer);
    if (candidatePrice < finalPrice) {
      finalPrice = candidatePrice;
      appliedOfferId = offer.id;
    }
  });

  return {
    serviceName: service.name,
    basePrice,
    finalPrice,
    appliedOfferId,
  };
};
