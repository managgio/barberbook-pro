import { CommerceOfferTarget } from '../../domain/entities/offer-read.entity';
import { CommerceOfferScope } from '../../ports/outbound/offer-management.port';
import { RequestContext } from '../../../../shared/application/request-context';

export type UpdateOfferCommand = {
  context: RequestContext;
  offerId: string;
  name?: string;
  description?: string;
  discountType?: string;
  discountValue?: number;
  scope?: CommerceOfferScope;
  target?: CommerceOfferTarget;
  categoryIds?: string[];
  serviceIds?: string[];
  productCategoryIds?: string[];
  productIds?: string[];
  startDate?: string;
  endDate?: string;
  active?: boolean;
};
