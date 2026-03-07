import { DomainError } from '../../../../shared/domain/domain-error';
import { ServiceCategoryRepositoryPort } from '../../ports/outbound/service-category-repository.port';
import { GetServiceCategoryByIdQuery } from '../queries/get-service-category-by-id.query';

export class GetServiceCategoryByIdUseCase {
  constructor(private readonly serviceCategoryRepositoryPort: ServiceCategoryRepositoryPort) {}

  async execute(query: GetServiceCategoryByIdQuery) {
    const category = await this.serviceCategoryRepositoryPort.findByIdAndLocalId({
      id: query.categoryId,
      localId: query.context.localId,
      withServices: query.withServices,
    });
    if (!category) {
      throw new DomainError('Category not found', 'CATEGORY_NOT_FOUND');
    }
    return category;
  }
}

