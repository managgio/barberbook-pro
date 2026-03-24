import { computeServicePricing } from './services.pricing';

type ServiceWithCategory = {
  id: string;
  name: string;
  description: string;
  price: number | { toString(): string };
  duration: number;
  position: number;
  isArchived: boolean;
  categoryId: string | null;
  category?:
    | {
        id: string;
        name: string;
        description: string | null;
        position: number;
      }
    | null;
  finalPrice?: number;
  appliedOffer?: {
    id: string;
    name: string;
    description: string;
    discountType: string;
    discountValue: number;
    scope: string;
    startDate: Date | null;
    endDate: Date | null;
    amountOff: number;
  } | null;
};

export const mapService = (service: ServiceWithCategory, pricing?: ReturnType<typeof computeServicePricing>) => {
  const price = Number(service.price);
  const finalPrice = pricing?.finalPrice ?? service.finalPrice ?? price;
  const appliedOffer = pricing?.appliedOffer ?? service.appliedOffer ?? null;
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    price,
    finalPrice,
    duration: service.duration,
    position: service.position,
    isArchived: service.isArchived,
    categoryId: service.categoryId,
    category: service.category
      ? {
          id: service.category.id,
          name: service.category.name,
          description: service.category.description ?? '',
          position: service.category.position,
        }
      : null,
    appliedOffer: appliedOffer
      ? {
          ...appliedOffer,
          amountOff: Number(appliedOffer.amountOff),
        }
      : null,
  };
};
