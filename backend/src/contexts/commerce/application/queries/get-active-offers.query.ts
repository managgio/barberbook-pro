import { RequestContext } from '../../../../shared/application/request-context';
import { CommerceOfferTarget } from '../../domain/entities/offer-read.entity';

export type GetActiveOffersQuery = {
  context: RequestContext;
  target?: CommerceOfferTarget;
  now?: Date;
};
