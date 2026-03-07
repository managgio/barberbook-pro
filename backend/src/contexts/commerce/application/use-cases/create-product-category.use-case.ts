import { ProductCategoryRepositoryPort } from '../../ports/outbound/product-category-repository.port';
import { CreateProductCategoryCommand } from '../commands/create-product-category.command';

export class CreateProductCategoryUseCase {
  constructor(private readonly productCategoryRepositoryPort: ProductCategoryRepositoryPort) {}

  execute(command: CreateProductCategoryCommand) {
    return this.productCategoryRepositoryPort.create({
      localId: command.context.localId,
      name: command.name,
      description: command.description ?? '',
      position: command.position ?? 0,
    });
  }
}

