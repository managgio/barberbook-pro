import { CommerceOfferReadPort } from '../../ports/outbound/offer-read.port';
import { GetOffersQuery } from '../queries/get-offers.query';

export class GetOffersUseCase {
  constructor(private readonly offerReadPort: CommerceOfferReadPort) {}

  execute(query: GetOffersQuery) {
    return this.offerReadPort.listOffers({
      localId: query.context.localId,
      target: query.target,
    });
  }
}
