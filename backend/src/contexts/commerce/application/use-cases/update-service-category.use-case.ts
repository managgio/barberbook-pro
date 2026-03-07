import { DomainError } from '../../../../shared/domain/domain-error';
import { ServiceCategoryRepositoryPort } from '../../ports/outbound/service-category-repository.port';
import { UpdateServiceCategoryCommand } from '../commands/update-service-category.command';

export class UpdateServiceCategoryUseCase {
  constructor(private readonly serviceCategoryRepositoryPort: ServiceCategoryRepositoryPort) {}

  async execute(command: UpdateServiceCategoryCommand) {
    const existing = await this.serviceCategoryRepositoryPort.findByIdAndLocalId({
      id: command.categoryId,
      localId: command.context.localId,
      withServices: false,
    });
    if (!existing) {
      throw new DomainError('Category not found', 'CATEGORY_NOT_FOUND');
    }

    return this.serviceCategoryRepositoryPort.updateById(command.categoryId, {
      name: command.name,
      description: command.description,
      position: command.position,
    });
  }
}

