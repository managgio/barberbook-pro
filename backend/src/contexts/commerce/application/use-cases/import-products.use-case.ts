import { DomainError } from '../../../../shared/domain/domain-error';
import { CommerceProductManagementPort } from '../../ports/outbound/product-management.port';
import { ImportProductsCommand } from '../commands/import-products.command';

export class ImportProductsUseCase {
  constructor(private readonly productManagementPort: CommerceProductManagementPort) {}

  async execute(command: ImportProductsCommand): Promise<{ created: number; updated: number }> {
    const destinationLocalId = command.targetLocalId ?? command.context.localId;
    const locations = await this.productManagementPort.findLocationsByIds([
      command.sourceLocalId,
      destinationLocalId,
    ]);

    const source = locations.find((location) => location.id === command.sourceLocalId) ?? null;
    const destination = locations.find((location) => location.id === destinationLocalId) ?? null;

    if (!source || !destination) {
      throw new DomainError('Location not found', 'LOCATION_NOT_FOUND');
    }

    if (source.brandId !== destination.brandId) {
      throw new DomainError(
        'Products can only be imported between locations of the same brand',
        'PRODUCT_IMPORT_CROSS_BRAND_FORBIDDEN',
      );
    }

    const destinationEnabled = await this.productManagementPort.areProductsEnabled({
      localId: destination.id,
      brandId: destination.brandId,
    });
    if (!destinationEnabled) {
      throw new DomainError(
        'Products module is disabled on destination location',
        'PRODUCT_IMPORT_TARGET_DISABLED',
      );
    }

    return this.productManagementPort.importProducts({
      sourceLocalId: command.sourceLocalId,
      destinationLocalId,
    });
  }
}
