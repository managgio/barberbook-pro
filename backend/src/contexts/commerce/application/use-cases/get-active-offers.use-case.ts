import { CommerceOfferReadPort } from '../../ports/outbound/offer-read.port';
import { GetActiveOffersQuery } from '../queries/get-active-offers.query';

export class GetActiveOffersUseCase {
  constructor(private readonly offerReadPort: CommerceOfferReadPort) {}

  execute(query: GetActiveOffersQuery) {
    return this.offerReadPort.listActiveOffers({
      localId: query.context.localId,
      target: query.target,
      now: query.now || new Date(),
    });
  }
}
