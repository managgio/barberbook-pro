import { DomainError } from '../../../../shared/domain/domain-error';
import { CommerceOfferReadPort } from '../../ports/outbound/offer-read.port';
import { CommerceOfferManagementPort } from '../../ports/outbound/offer-management.port';
import { CreateOfferCommand } from '../commands/create-offer.command';
import {
  validateOfferDateRange,
  validateOfferScopeRequirements,
  validateOfferTargetScopeCompatibility,
} from './offer-scope-validation';

export class CreateOfferUseCase {
  constructor(
    private readonly offerManagementPort: CommerceOfferManagementPort,
    private readonly offerReadPort: CommerceOfferReadPort,
  ) {}

  async execute(command: CreateOfferCommand) {
    const localId = command.context.localId;
    const target = command.target ?? 'service';

    validateOfferTargetScopeCompatibility(target, command.scope);
    validateOfferScopeRequirements({
      scope: command.scope,
      target,
      categoryIds: command.categoryIds,
      serviceIds: command.serviceIds,
      productCategoryIds: command.productCategoryIds,
      productIds: command.productIds,
    });
    validateOfferDateRange(command.startDate, command.endDate);

    const created = await this.offerManagementPort.createOffer({
      localId,
      input: {
        name: command.name,
        description: command.description,
        discountType: command.discountType,
        discountValue: command.discountValue,
        scope: command.scope,
        target,
        startDate: command.startDate ? new Date(command.startDate) : null,
        endDate: command.endDate ? new Date(command.endDate) : null,
        active: command.active ?? true,
        categoryIds: command.categoryIds,
        serviceIds: command.serviceIds,
        productCategoryIds: command.productCategoryIds,
        productIds: command.productIds,
      },
    });

    const offer = await this.offerReadPort.getOfferById({
      localId,
      offerId: created.id,
    });
    if (!offer) {
      throw new DomainError('Offer not found', 'OFFER_NOT_FOUND');
    }

    return offer;
  }
}
