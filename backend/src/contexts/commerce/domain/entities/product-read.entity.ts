import { CommerceAppliedOffer } from './service-read.entity';

export type CommerceProductReadModel = {
  id: string;
  name: string;
  description: string;
  sku: string | null;
  price: number;
  stock: number;
  minStock: number;
  imageUrl: string | null;
  imageFileId: string | null;
  isActive: boolean;
  isPublic: boolean;
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
