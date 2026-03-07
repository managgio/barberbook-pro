import { RequestContext } from '../../../../shared/application/request-context';
import { CommerceOfferTarget } from '../../domain/entities/offer-read.entity';

export type GetOffersQuery = {
  context: RequestContext;
  target?: CommerceOfferTarget;
};
