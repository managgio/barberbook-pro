export type CommerceAppliedOffer = {
  id: string;
  name: string;
  description: string;
  discountType: string;
  discountValue: number;
  scope: string;
  startDate: Date | null;
  endDate: Date | null;
  amountOff: number;
};

export type CommerceServiceReadModel = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  isArchived: boolean;
  categoryId: string | null;
  category: {
    id: string;
    name: string;
    description: string;
    position: number;
  } | null;
  finalPrice: number;
  appliedOffer: CommerceAppliedOffer | null;
};
