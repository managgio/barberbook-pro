import { DomainError } from '../../../../shared/domain/domain-error';
import { CommerceProductReadPort } from '../../ports/outbound/product-read.port';
import { CommerceProductManagementPort } from '../../ports/outbound/product-management.port';
import { UpdateProductCommand } from '../commands/update-product.command';

export class UpdateProductUseCase {
  constructor(
    private readonly productManagementPort: CommerceProductManagementPort,
    private readonly productReadPort: CommerceProductReadPort,
  ) {}

  async execute(command: UpdateProductCommand) {
    const scope = {
      localId: command.context.localId,
      brandId: command.context.brandId,
    };
    const productsEnabled = await this.productManagementPort.areProductsEnabled(scope);
    if (!productsEnabled) {
      throw new DomainError('Products module is disabled', 'PRODUCTS_MODULE_DISABLED');
    }

    const existing = await this.productManagementPort.findActiveProductById({
      localId: scope.localId,
      productId: command.productId,
    });
    if (!existing) {
      throw new DomainError('Product not found', 'PRODUCT_NOT_FOUND');
    }

    const categoryId = command.categoryId === undefined ? existing.categoryId : command.categoryId;
    const position = command.position === undefined ? existing.position : command.position;
    const categoriesEnabled = await this.productManagementPort.areCategoriesEnabled(scope);
    if (categoriesEnabled && !categoryId) {
      throw new DomainError(
        'Category is required while product categorization is enabled',
        'PRODUCT_CATEGORY_REQUIRED_WHEN_ENABLED',
      );
    }

    if (categoryId) {
      const categoryExists = await this.productManagementPort.categoryExists({
        localId: scope.localId,
        categoryId,
      });
      if (!categoryExists) {
        throw new DomainError('Category not found', 'PRODUCT_CATEGORY_NOT_FOUND');
      }
    }

    const updated = await this.productManagementPort.updateProduct({
      localId: scope.localId,
      productId: command.productId,
      input: {
        name: command.name,
        description: command.description,
        sku: command.sku,
        price: command.price,
        position,
        stock: command.stock,
        minStock: command.minStock,
        categoryId,
        imageUrl: command.imageUrl,
        imageFileId: command.imageFileId,
        isActive: command.isActive,
        isPublic: command.isPublic,
      },
    });
    if (!updated) {
      throw new DomainError('Product not found', 'PRODUCT_NOT_FOUND');
    }

    const product = await this.productReadPort.getProductById({
      localId: scope.localId,
      brandId: scope.brandId,
      productId: updated.id,
      includeArchived: true,
    });
    if (!product) {
      throw new DomainError('Product not found', 'PRODUCT_NOT_FOUND');
    }

    return product;
  }
}
