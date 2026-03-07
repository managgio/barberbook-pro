import { CommerceOfferTarget } from '../../domain/entities/offer-read.entity';

export type CommerceOfferScope = 'all' | 'categories' | 'services' | 'products';

export const COMMERCE_OFFER_MANAGEMENT_PORT = Symbol('COMMERCE_OFFER_MANAGEMENT_PORT');

export type CreateCommerceOfferInput = {
  name: string;
  description?: string;
  discountType: string;
  discountValue: number;
  scope: CommerceOfferScope;
  target: CommerceOfferTarget;
  startDate: Date | null;
  endDate: Date | null;
  active: boolean;
  categoryIds?: string[];
  serviceIds?: string[];
  productCategoryIds?: string[];
  productIds?: string[];
};

export type UpdateCommerceOfferInput = {
  name?: string;
  description?: string;
  discountType?: string;
  discountValue?: number;
  scope?: CommerceOfferScope;
  target?: CommerceOfferTarget;
  startDate?: Date | null;
  endDate?: Date | null;
  active?: boolean;
  categoryIds?: string[];
  serviceIds?: string[];
  productCategoryIds?: string[];
  productIds?: string[];
};

export type CommerceOfferForUpdate = {
  id: string;
  target: CommerceOfferTarget;
  scope: CommerceOfferScope;
};

export interface CommerceOfferManagementPort {
  createOffer(params: { localId: string; input: CreateCommerceOfferInput }): Promise<{ id: string }>;
  findOfferForUpdate(params: { localId: string; offerId: string }): Promise<CommerceOfferForUpdate | null>;
  updateOffer(params: {
    localId: string;
    offerId: string;
    resolvedTarget: CommerceOfferTarget;
    resolvedScope: CommerceOfferScope;
    input: UpdateCommerceOfferInput;
  }): Promise<{ id: string } | null>;
  deleteOffer(params: { localId: string; offerId: string }): Promise<boolean>;
}
