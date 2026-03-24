import { DomainError } from '../../../../shared/domain/domain-error';
import { CommerceProductReadPort } from '../../ports/outbound/product-read.port';
import { CommerceProductManagementPort } from '../../ports/outbound/product-management.port';
import { CreateProductCommand } from '../commands/create-product.command';

export class CreateProductUseCase {
  constructor(
    private readonly productManagementPort: CommerceProductManagementPort,
    private readonly productReadPort: CommerceProductReadPort,
  ) {}

  async execute(command: CreateProductCommand) {
    const scope = {
      localId: command.context.localId,
      brandId: command.context.brandId,
    };
    const productsEnabled = await this.productManagementPort.areProductsEnabled(scope);
    if (!productsEnabled) {
      throw new DomainError('Products module is disabled', 'PRODUCTS_MODULE_DISABLED');
    }

    const categoryId = command.categoryId ?? null;
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

    const name = command.name.trim();
    const existing = await this.productManagementPort.findActiveProductByNormalizedName({
      localId: scope.localId,
      normalizedName: name.toLowerCase(),
    });

    const input = {
      name,
      description: command.description ?? '',
      sku: command.sku ?? null,
      price: command.price,
      position:
        command.position ??
        (await this.productManagementPort.getNextProductPosition({
          localId: scope.localId,
          categoryId,
        })),
      stock: command.stock ?? 0,
      minStock: command.minStock ?? 0,
      categoryId,
      imageUrl: command.imageUrl ?? null,
      imageFileId: command.imageFileId ?? null,
      isActive: command.isActive ?? true,
      isPublic: command.isPublic ?? true,
    };

    const saved = existing
      ? await this.productManagementPort.updateProduct({
          localId: scope.localId,
          productId: existing.id,
          input,
        })
      : await this.productManagementPort.createProduct({
          localId: scope.localId,
          input,
        });

    if (!saved) {
      throw new DomainError('Product not found', 'PRODUCT_NOT_FOUND');
    }

    const product = await this.productReadPort.getProductById({
      localId: scope.localId,
      brandId: scope.brandId,
      productId: saved.id,
      includeArchived: true,
    });
    if (!product) {
      throw new DomainError('Product not found', 'PRODUCT_NOT_FOUND');
    }

    return product;
  }
}
