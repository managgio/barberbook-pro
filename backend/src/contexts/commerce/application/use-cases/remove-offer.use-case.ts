import { DomainError } from '../../../../shared/domain/domain-error';
import { CommerceOfferManagementPort } from '../../ports/outbound/offer-management.port';
import { RemoveOfferCommand } from '../commands/remove-offer.command';

export class RemoveOfferUseCase {
  constructor(private readonly offerManagementPort: CommerceOfferManagementPort) {}

  async execute(command: RemoveOfferCommand): Promise<{ success: true }> {
    const deleted = await this.offerManagementPort.deleteOffer({
      localId: command.context.localId,
      offerId: command.offerId,
    });

    if (!deleted) {
      throw new DomainError('Offer not found', 'OFFER_NOT_FOUND');
    }

    return { success: true };
  }
}
