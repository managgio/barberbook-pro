import { DomainError } from '../../../../shared/domain/domain-error';
import { CommerceOfferReadPort } from '../../ports/outbound/offer-read.port';
import { CommerceOfferManagementPort } from '../../ports/outbound/offer-management.port';
import { UpdateOfferCommand } from '../commands/update-offer.command';
import {
  validateOfferDateRange,
  validateOfferScopeRequirements,
  validateOfferTargetScopeCompatibility,
} from './offer-scope-validation';

export class UpdateOfferUseCase {
  constructor(
    private readonly offerManagementPort: CommerceOfferManagementPort,
    private readonly offerReadPort: CommerceOfferReadPort,
  ) {}

  async execute(command: UpdateOfferCommand) {
    const localId = command.context.localId;
    const existing = await this.offerManagementPort.findOfferForUpdate({
      localId,
      offerId: command.offerId,
    });
    if (!existing) {
      throw new DomainError('Offer not found', 'OFFER_NOT_FOUND');
    }

    const resolvedTarget = command.target ?? existing.target;
    const resolvedScope = command.scope ?? existing.scope;

    validateOfferTargetScopeCompatibility(resolvedTarget, resolvedScope);

    if (command.scope !== undefined) {
      validateOfferScopeRequirements({
        scope: command.scope,
        target: resolvedTarget,
        categoryIds: command.categoryIds,
        serviceIds: command.serviceIds,
        productCategoryIds: command.productCategoryIds,
        productIds: command.productIds,
      });
    }

    validateOfferDateRange(command.startDate, command.endDate);

    const updated = await this.offerManagementPort.updateOffer({
      localId,
      offerId: command.offerId,
      resolvedTarget,
      resolvedScope,
      input: {
        name: command.name,
        description: command.description,
        discountType: command.discountType,
        discountValue: command.discountValue,
        scope: command.scope,
        target: command.target,
        startDate: command.startDate ? new Date(command.startDate) : null,
        endDate: command.endDate ? new Date(command.endDate) : null,
        active: command.active,
        categoryIds: command.categoryIds,
        serviceIds: command.serviceIds,
        productCategoryIds: command.productCategoryIds,
        productIds: command.productIds,
      },
    });
    if (!updated) {
      throw new DomainError('Offer not found', 'OFFER_NOT_FOUND');
    }

    const offer = await this.offerReadPort.getOfferById({
      localId,
      offerId: updated.id,
    });
    if (!offer) {
      throw new DomainError('Offer not found', 'OFFER_NOT_FOUND');
    }

    return offer;
  }
}
