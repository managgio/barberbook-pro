import { DomainError } from '../../../../shared/domain/domain-error';
import { CommerceServiceManagementPort } from '../../ports/outbound/service-management.port';
import { CommerceServiceReadPort } from '../../ports/outbound/service-read.port';
import { CreateServiceCommand } from '../commands/create-service.command';

export class CreateServiceUseCase {
  constructor(
    private readonly serviceManagementPort: CommerceServiceManagementPort,
    private readonly serviceReadPort: CommerceServiceReadPort,
  ) {}

  async execute(command: CreateServiceCommand) {
    const localId = command.context.localId;
    const categoryId = command.categoryId ?? null;
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

    const created = await this.serviceManagementPort.createService({
      localId,
      input: {
        name: command.name,
        description: command.description ?? '',
        price: command.price,
        duration: command.duration,
        categoryId,
        position:
          command.position ??
          (await this.serviceManagementPort.getNextServicePosition({
            localId,
            categoryId,
          })),
      },
    });

    const service = await this.serviceReadPort.getServiceById({
      localId,
      serviceId: created.id,
      includeArchived: true,
    });
    if (!service) {
      throw new DomainError('Service not found', 'SERVICE_NOT_FOUND');
    }

    return service;
  }
}
