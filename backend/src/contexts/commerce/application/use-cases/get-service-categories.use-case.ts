import { ServiceCategoryRepositoryPort } from '../../ports/outbound/service-category-repository.port';
import { GetServiceCategoriesQuery } from '../queries/get-service-categories.query';

export class GetServiceCategoriesUseCase {
  constructor(private readonly serviceCategoryRepositoryPort: ServiceCategoryRepositoryPort) {}

  execute(query: GetServiceCategoriesQuery) {
    return this.serviceCategoryRepositoryPort.listByLocalId({
      localId: query.context.localId,
      withServices: query.withServices,
    });
  }
}

