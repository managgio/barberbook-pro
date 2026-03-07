import { DomainError } from '../../../../shared/domain/domain-error';
import { CommerceProductManagementPort } from '../../ports/outbound/product-management.port';
import { CommerceProductMediaStoragePort } from '../../ports/outbound/product-media-storage.port';
import { RemoveProductCommand } from '../commands/remove-product.command';

export class RemoveProductUseCase {
  constructor(
    private readonly productManagementPort: CommerceProductManagementPort,
    private readonly productMediaStoragePort: CommerceProductMediaStoragePort,
  ) {}

  async execute(command: RemoveProductCommand): Promise<{ success: true; archived?: true }> {
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

    if (existing.imageFileId) {
      await this.productMediaStoragePort.deleteImageFile({
        productId: existing.id,
        fileId: existing.imageFileId,
      });
    }

    const inAppointments = await this.productManagementPort.countAppointmentUsages(existing.id);
    if (inAppointments > 0) {
      await this.productManagementPort.archiveProduct({
        localId: scope.localId,
        productId: existing.id,
      });
      return { success: true, archived: true };
    }

    await this.productManagementPort.deleteProduct({
      localId: scope.localId,
      productId: existing.id,
    });
    return { success: true };
  }
}
