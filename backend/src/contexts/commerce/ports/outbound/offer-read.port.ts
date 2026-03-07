import { CommerceOfferReadModel, CommerceOfferTarget } from '../../domain/entities/offer-read.entity';

export const COMMERCE_OFFER_READ_PORT = Symbol('COMMERCE_OFFER_READ_PORT');

export interface CommerceOfferReadPort {
  listOffers(params: { localId: string; target?: CommerceOfferTarget }): Promise<CommerceOfferReadModel[]>;
  listActiveOffers(params: { localId: string; target?: CommerceOfferTarget; now: Date }): Promise<CommerceOfferReadModel[]>;
  getOfferById(params: { localId: string; offerId: string }): Promise<CommerceOfferReadModel | null>;
}
