import { DomainError } from '../../../../shared/domain/domain-error';
import { ProductCategoryRepositoryPort } from '../../ports/outbound/product-category-repository.port';
import { UpdateProductCategoryCommand } from '../commands/update-product-category.command';

export class UpdateProductCategoryUseCase {
  constructor(private readonly productCategoryRepositoryPort: ProductCategoryRepositoryPort) {}

  async execute(command: UpdateProductCategoryCommand) {
    const existing = await this.productCategoryRepositoryPort.findByIdAndLocalId({
      id: command.categoryId,
      localId: command.context.localId,
      withProducts: false,
    });
    if (!existing) {
      throw new DomainError('Category not found', 'PRODUCT_CATEGORY_NOT_FOUND');
    }

    return this.productCategoryRepositoryPort.updateById(command.categoryId, {
      name: command.name,
      description: command.description,
      position: command.position,
    });
  }
}

