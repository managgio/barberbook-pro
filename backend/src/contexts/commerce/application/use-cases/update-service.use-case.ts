import { DomainError } from '../../../../shared/domain/domain-error';
import { CommerceServiceManagementPort } from '../../ports/outbound/service-management.port';
import { CommerceServiceReadPort } from '../../ports/outbound/service-read.port';
import { UpdateServiceCommand } from '../commands/update-service.command';

export class UpdateServiceUseCase {
  constructor(
    private readonly serviceManagementPort: CommerceServiceManagementPort,
    private readonly serviceReadPort: CommerceServiceReadPort,
  ) {}

  async execute(command: UpdateServiceCommand) {
    const localId = command.context.localId;
    const existing = await this.serviceManagementPort.findServiceForManagement({
      localId,
      serviceId: command.serviceId,
      includeArchived: false,
    });
    if (!existing) {
      throw new DomainError('Service not found', 'SERVICE_NOT_FOUND');
    }

    const categoryId = command.categoryId === undefined ? existing.categoryId : command.categoryId;
    const position = command.position === undefined ? existing.position : command.position;
    const categoriesEnabled = await this.serviceManagementPort.areCategoriesEnabled(localId);
    if (categoriesEnabled && !categoryId) {
      throw new DomainError(
        'Category is required while service categorization is enabled',
        'SERVICE_CATEGORY_REQUIRED_WHEN_ENABLED',
      );
    }

    if (categoryId) {
      const exists = await this.serviceManagementPort.categoryExists({
        localId,
        categoryId,
      });
      if (!exists) {
        throw new DomainError('Category not found', 'CATEGORY_NOT_FOUND');
      }
    }

    const updated = await this.serviceManagementPort.updateService({
      localId,
      serviceId: command.serviceId,
      input: {
        name: command.name,
        description: command.description,
        price: command.price,
        duration: command.duration,
        categoryId,
        position,
      },
    });
    if (!updated) {
      throw new DomainError('Service not found', 'SERVICE_NOT_FOUND');
    }

    const service = await this.serviceReadPort.getServiceById({
      localId,
      serviceId: updated.id,
      includeArchived: true,
    });
    if (!service) {
      throw new DomainError('Service not found', 'SERVICE_NOT_FOUND');
    }

    return service;
  }
}
