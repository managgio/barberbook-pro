export type CommerceOfferTarget = 'service' | 'product';

export type CommerceOfferReadModel = {
  id: string;
  name: string;
  description: string;
  discountType: string;
  discountValue: number;
  scope: string;
  target: CommerceOfferTarget;
  startDate: Date | null;
  endDate: Date | null;
  active: boolean;
  categories: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string }>;
  productCategories: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string }>;
};
