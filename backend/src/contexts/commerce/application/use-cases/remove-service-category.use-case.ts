import { DomainError } from '../../../../shared/domain/domain-error';
import { ServiceCategoryRepositoryPort } from '../../ports/outbound/service-category-repository.port';
import { RemoveServiceCategoryCommand } from '../commands/remove-service-category.command';

export class RemoveServiceCategoryUseCase {
  constructor(private readonly serviceCategoryRepositoryPort: ServiceCategoryRepositoryPort) {}

  async execute(command: RemoveServiceCategoryCommand) {
    const existing = await this.serviceCategoryRepositoryPort.findByIdAndLocalId({
      id: command.categoryId,
      localId: command.context.localId,
      withServices: false,
    });
    if (!existing) {
      throw new DomainError('Category not found', 'CATEGORY_NOT_FOUND');
    }

    const categoriesEnabled = await this.serviceCategoryRepositoryPort.areCategoriesEnabled(command.context.localId);
    const assignedServices = await this.serviceCategoryRepositoryPort.countAssignedServices({
      localId: command.context.localId,
      categoryId: command.categoryId,
    });

    if (categoriesEnabled && assignedServices > 0) {
      throw new DomainError(
        'Cannot delete category with assigned services while categorization is enabled',
        'CATEGORY_HAS_ASSIGNED_SERVICES',
      );
    }

    await this.serviceCategoryRepositoryPort.deleteById(command.categoryId);
  }
}

