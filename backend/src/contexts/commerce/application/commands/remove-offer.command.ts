import { RequestContext } from '../../../../shared/application/request-context';

export type RemoveOfferCommand = {
  context: RequestContext;
  offerId: string;
};
