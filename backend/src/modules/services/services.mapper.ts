import { Service, ServiceCategory } from '@prisma/client';
import { computeServicePricing } from './services.pricing';

type ServiceWithCategory = Service & { category?: ServiceCategory | null };

export const mapService = (service: ServiceWithCategory, pricing?: ReturnType<typeof computeServicePricing>) => {
  const price = parseFloat(service.price.toString());
  const finalPrice = pricing?.finalPrice ?? price;
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    price,
    finalPrice,
    duration: service.duration,
    categoryId: service.categoryId,
    category: service.category
      ? {
          id: service.category.id,
          name: service.category.name,
          description: service.category.description ?? '',
          position: service.category.position,
        }
      : null,
    appliedOffer: pricing?.appliedOffer
      ? {
          ...pricing.appliedOffer,
          amountOff: Number(pricing.appliedOffer.amountOff),
        }
      : null,
  };
};
