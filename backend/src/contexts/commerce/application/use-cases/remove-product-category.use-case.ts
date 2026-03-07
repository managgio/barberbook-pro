import { DomainError } from '../../../../shared/domain/domain-error';
import { ProductCategoryRepositoryPort } from '../../ports/outbound/product-category-repository.port';
import { RemoveProductCategoryCommand } from '../commands/remove-product-category.command';

export class RemoveProductCategoryUseCase {
  constructor(private readonly productCategoryRepositoryPort: ProductCategoryRepositoryPort) {}

  async execute(command: RemoveProductCategoryCommand) {
    const existing = await this.productCategoryRepositoryPort.findByIdAndLocalId({
      id: command.categoryId,
      localId: command.context.localId,
      withProducts: false,
    });
    if (!existing) {
      throw new DomainError('Category not found', 'PRODUCT_CATEGORY_NOT_FOUND');
    }

    const categoriesEnabled = await this.productCategoryRepositoryPort.areCategoriesEnabled({
      localId: command.context.localId,
      brandId: command.context.brandId,
    });
    const assignedProducts = await this.productCategoryRepositoryPort.countAssignedProducts({
      localId: command.context.localId,
      categoryId: command.categoryId,
    });

    if (categoriesEnabled && assignedProducts > 0) {
      throw new DomainError(
        'Cannot delete category with assigned products while categorization is enabled',
        'PRODUCT_CATEGORY_HAS_ASSIGNED_PRODUCTS',
      );
    }

    await this.productCategoryRepositoryPort.deleteById(command.categoryId);
  }
}

