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
import { LocalizationService } from '../localization/localization.service';
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
    private readonly localizationService: LocalizationService,
  ) {
    this.getServiceCategoriesUseCase = new GetServiceCategoriesUseCase(this.serviceCategoryRepositoryPort);
    this.getServiceCategoryByIdUseCase = new GetServiceCategoryByIdUseCase(this.serviceCategoryRepositoryPort);
    this.createServiceCategoryUseCase = new CreateServiceCategoryUseCase(this.serviceCategoryRepositoryPort);
    this.updateServiceCategoryUseCase = new UpdateServiceCategoryUseCase(this.serviceCategoryRepositoryPort);
    this.removeServiceCategoryUseCase = new RemoveServiceCategoryUseCase(this.serviceCategoryRepositoryPort);
  }

  async findAll(withServices = true) {
    const context = this.tenantContextPort.getRequestContext();
    const categories = await this.getServiceCategoriesUseCase.execute({
      context,
      withServices,
    });
    const mapped = categories.map((category) =>
      mapServiceCategory(category, { includeServices: withServices }),
    );
    const { items } = await this.localizationService.localizeCollection({
      context,
      entityType: 'service_category',
      items: mapped,
      descriptors: [
        {
          fieldKey: 'name',
          getValue: (item) => item.name,
          setValue: (item, value) => {
            item.name = value;
          },
        },
        {
          fieldKey: 'description',
          getValue: (item) => item.description,
          setValue: (item, value) => {
            item.description = value;
          },
        },
      ],
    });

    if (withServices) {
      const nestedServices = items.flatMap((category) => category.services || []);
      await this.localizationService.localizeCollection({
        context,
        entityType: 'service',
        items: nestedServices,
        descriptors: [
          {
            fieldKey: 'name',
            getValue: (item) => item.name,
            setValue: (item, value) => {
              item.name = value;
            },
          },
          {
            fieldKey: 'description',
            getValue: (item) => item.description,
            setValue: (item, value) => {
              item.description = value;
            },
          },
        ],
      });
    }

    return items;
  }

  async findOne(id: string, withServices = true) {
    const context = this.tenantContextPort.getRequestContext();
    try {
      const category = await this.getServiceCategoryByIdUseCase.execute({
        context,
        categoryId: id,
        withServices,
      });
      const mapped = mapServiceCategory(category, { includeServices: withServices });
      const localizedCategory = (
        await this.localizationService.localizeCollection({
          context,
          entityType: 'service_category',
          items: [mapped],
          descriptors: [
            {
              fieldKey: 'name',
              getValue: (item) => item.name,
              setValue: (item, value) => {
                item.name = value;
              },
            },
            {
              fieldKey: 'description',
              getValue: (item) => item.description,
              setValue: (item, value) => {
                item.description = value;
              },
            },
          ],
        })
      ).items[0];
      if (withServices && localizedCategory?.services) {
        await this.localizationService.localizeCollection({
          context,
          entityType: 'service',
          items: localizedCategory.services,
          descriptors: [
            {
              fieldKey: 'name',
              getValue: (item) => item.name,
              setValue: (item, value) => {
                item.name = value;
              },
            },
            {
              fieldKey: 'description',
              getValue: (item) => item.description,
              setValue: (item, value) => {
                item.description = value;
              },
            },
          ],
        });
      }
      return localizedCategory;
    } catch (error) {
      this.rethrowHttpError(error);
      throw error;
    }
  }

  async create(data: CreateServiceCategoryDto) {
    const context = this.tenantContextPort.getRequestContext();
    const created = await this.createServiceCategoryUseCase.execute({
      context,
      name: data.name,
      description: data.description,
      position: data.position,
    });
    await this.localizationService.syncEntitySourceFields({
      context,
      entityType: 'service_category',
      entityId: created.id,
      fields: {
        name: created.name,
        description: created.description,
      },
    });
    return mapServiceCategory(created, { includeServices: false });
  }

  async update(id: string, data: UpdateServiceCategoryDto) {
    const context = this.tenantContextPort.getRequestContext();
    try {
      const updated = await this.updateServiceCategoryUseCase.execute({
        context,
        categoryId: id,
        name: data.name,
        description: data.description,
        position: data.position,
      });
      await this.localizationService.syncEntitySourceFields({
        context,
        entityType: 'service_category',
        entityId: updated.id,
        fields: {
          name: updated.name,
          description: updated.description,
        },
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
