import { DomainError } from '../../../../shared/domain/domain-error';
import { CommerceOfferTarget } from '../../domain/entities/offer-read.entity';
import { CommerceOfferScope } from '../../ports/outbound/offer-management.port';

export const validateOfferTargetScopeCompatibility = (
  target: CommerceOfferTarget,
  scope: CommerceOfferScope,
): void => {
  if (target === 'product' && scope === 'services') {
    throw new DomainError(
      'Product offers cannot use services scope',
      'OFFER_PRODUCT_TARGET_INVALID_SERVICE_SCOPE',
    );
  }
  if (target === 'service' && scope === 'products') {
    throw new DomainError(
      'Service offers cannot use products scope',
      'OFFER_SERVICE_TARGET_INVALID_PRODUCT_SCOPE',
    );
  }
};

export const validateOfferDateRange = (startDate?: string, endDate?: string): void => {
  if (!startDate || !endDate) return;
  if (new Date(startDate) > new Date(endDate)) {
    throw new DomainError('Start date cannot be after end date', 'OFFER_INVALID_DATE_RANGE');
  }
};

export const validateOfferScopeRequirements = (params: {
  scope: CommerceOfferScope;
  target: CommerceOfferTarget;
  categoryIds?: string[];
  serviceIds?: string[];
  productCategoryIds?: string[];
  productIds?: string[];
}): void => {
  if (params.scope === 'categories') {
    if (params.target === 'service' && (!params.categoryIds || params.categoryIds.length === 0)) {
      throw new DomainError(
        'At least one service category is required for this offer',
        'OFFER_SERVICE_CATEGORY_IDS_REQUIRED',
      );
    }
    if (
      params.target === 'product' &&
      (!params.productCategoryIds || params.productCategoryIds.length === 0)
    ) {
      throw new DomainError(
        'At least one product category is required for this offer',
        'OFFER_PRODUCT_CATEGORY_IDS_REQUIRED',
      );
    }
  }

  if (params.scope === 'services' && (!params.serviceIds || params.serviceIds.length === 0)) {
    throw new DomainError('At least one service is required for this offer', 'OFFER_SERVICE_IDS_REQUIRED');
  }

  if (params.scope === 'products' && (!params.productIds || params.productIds.length === 0)) {
    throw new DomainError('At least one product is required for this offer', 'OFFER_PRODUCT_IDS_REQUIRED');
  }
};
