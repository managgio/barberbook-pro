import { ServiceCategoryRepositoryPort } from '../../ports/outbound/service-category-repository.port';
import { CreateServiceCategoryCommand } from '../commands/create-service-category.command';

export class CreateServiceCategoryUseCase {
  constructor(private readonly serviceCategoryRepositoryPort: ServiceCategoryRepositoryPort) {}

  execute(command: CreateServiceCategoryCommand) {
    return this.serviceCategoryRepositoryPort.create({
      localId: command.context.localId,
      name: command.name,
      description: command.description ?? '',
      position: command.position ?? 0,
    });
  }
}

