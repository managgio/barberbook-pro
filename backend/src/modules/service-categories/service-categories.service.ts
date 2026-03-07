import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateServiceCategoryUseCase } from '../../contexts/commerce/application/use-cases/create-service-category.use-case';
import { GetServiceCategoriesUseCase } from '../../contexts/commerce/application/use-cases/get-service-categories.use-case';
import { GetServiceCategoryByIdUseCase } from '../../contexts/commerce/application/use-cases/get-service-category-by-id.use-case';
import { RemoveServiceCategoryUseCase } from '../../contexts/commerce/application/use-cases/remove-service-category.use-case';
import { UpdateServiceCategoryUseCase } from '../../contexts/commerce/application/use-cases/update-service-category.use-case';
import {
  COMMERCE_SERVICE_CATEGORY_REPOSITORY_PORT,
  ServiceCategoryRepositoryPort,
} from '../../contexts/commerce/ports/outbound/service-category-repository.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { rethrowDomainErrorAsHttp } from '../../shared/interfaces/http/rethrow-domain-error-as-http';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { mapServiceCategory } from './service-categories.mapper';

@Injectable()
export class ServiceCategoriesService {
  private readonly getServiceCategoriesUseCase: GetServiceCategoriesUseCase;
  private readonly getServiceCategoryByIdUseCase: GetServiceCategoryByIdUseCase;
  private readonly createServiceCategoryUseCase: CreateServiceCategoryUseCase;
  private readonly updateServiceCategoryUseCase: UpdateServiceCategoryUseCase;
  private readonly removeServiceCategoryUseCase: RemoveServiceCategoryUseCase;

  constructor(
    @Inject(COMMERCE_SERVICE_CATEGORY_REPOSITORY_PORT)
    private readonly serviceCategoryRepositoryPort: ServiceCategoryRepositoryPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {
    this.getServiceCategoriesUseCase = new GetServiceCategoriesUseCase(this.serviceCategoryRepositoryPort);
    this.getServiceCategoryByIdUseCase = new GetServiceCategoryByIdUseCase(this.serviceCategoryRepositoryPort);
    this.createServiceCategoryUseCase = new CreateServiceCategoryUseCase(this.serviceCategoryRepositoryPort);
    this.updateServiceCategoryUseCase = new UpdateServiceCategoryUseCase(this.serviceCategoryRepositoryPort);
    this.removeServiceCategoryUseCase = new RemoveServiceCategoryUseCase(this.serviceCategoryRepositoryPort);
  }

  async findAll(withServices = true) {
    const categories = await this.getServiceCategoriesUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      withServices,
    });
    return categories.map((category) =>
      mapServiceCategory(category, { includeServices: withServices }),
    );
  }

  async findOne(id: string, withServices = true) {
    try {
      const category = await this.getServiceCategoryByIdUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        categoryId: id,
        withServices,
      });
      return mapServiceCategory(category, { includeServices: withServices });
    } catch (error) {
      this.rethrowHttpError(error);
      throw error;
    }
  }

  async create(data: CreateServiceCategoryDto) {
    const created = await this.createServiceCategoryUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      name: data.name,
      description: data.description,
      position: data.position,
    });
    return mapServiceCategory(created, { includeServices: false });
  }

  async update(id: string, data: UpdateServiceCategoryDto) {
    try {
      const updated = await this.updateServiceCategoryUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        categoryId: id,
        name: data.name,
        description: data.description,
        position: data.position,
      });
      return mapServiceCategory(updated, { includeServices: false });
    } catch (error) {
      this.rethrowHttpError(error);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.removeServiceCategoryUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        categoryId: id,
      });
      return { success: true };
    } catch (error) {
      this.rethrowHttpError(error);
      throw error;
    }
  }

  private rethrowHttpError(error: unknown): never | void {
    rethrowDomainErrorAsHttp(error, {
      CATEGORY_NOT_FOUND: () => new NotFoundException('Category not found'),
      CATEGORY_HAS_ASSIGNED_SERVICES: () =>
        new BadRequestException(
          'No puedes eliminar esta categoría mientras haya servicios asignados y la categorización esté activa.',
        ),
    });
  }
}
