import { DomainError } from '../../../../shared/domain/domain-error';
import { ProductCategoryRepositoryPort } from '../../ports/outbound/product-category-repository.port';
import { GetProductCategoryByIdQuery } from '../queries/get-product-category-by-id.query';

export class GetProductCategoryByIdUseCase {
  constructor(private readonly productCategoryRepositoryPort: ProductCategoryRepositoryPort) {}

  async execute(query: GetProductCategoryByIdQuery) {
    const category = await this.productCategoryRepositoryPort.findByIdAndLocalId({
      id: query.categoryId,
      localId: query.context.localId,
      withProducts: query.withProducts,
    });
    if (!category) {
      throw new DomainError('Category not found', 'PRODUCT_CATEGORY_NOT_FOUND');
    }
    return category;
  }
}

