import { ProductCategoryRepositoryPort } from '../../ports/outbound/product-category-repository.port';
import { GetProductCategoriesQuery } from '../queries/get-product-categories.query';

export class GetProductCategoriesUseCase {
  constructor(private readonly productCategoryRepositoryPort: ProductCategoryRepositoryPort) {}

  execute(query: GetProductCategoriesQuery) {
    return this.productCategoryRepositoryPort.listByLocalId({
      localId: query.context.localId,
      withProducts: query.withProducts,
    });
  }
}

