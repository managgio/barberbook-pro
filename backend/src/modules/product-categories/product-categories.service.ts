import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductCategoryUseCase } from '../../contexts/commerce/application/use-cases/create-product-category.use-case';
import { GetProductCategoriesUseCase } from '../../contexts/commerce/application/use-cases/get-product-categories.use-case';
import { GetProductCategoryByIdUseCase } from '../../contexts/commerce/application/use-cases/get-product-category-by-id.use-case';
import { RemoveProductCategoryUseCase } from '../../contexts/commerce/application/use-cases/remove-product-category.use-case';
import { UpdateProductCategoryUseCase } from '../../contexts/commerce/application/use-cases/update-product-category.use-case';
import {
  COMMERCE_PRODUCT_CATEGORY_REPOSITORY_PORT,
  ProductCategoryRepositoryPort,
} from '../../contexts/commerce/ports/outbound/product-category-repository.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { rethrowDomainErrorAsHttp } from '../../shared/interfaces/http/rethrow-domain-error-as-http';
import { LocalizationService } from '../localization/localization.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { mapProductCategory } from './product-categories.mapper';

@Injectable()
export class ProductCategoriesService {
  private readonly getProductCategoriesUseCase: GetProductCategoriesUseCase;
  private readonly getProductCategoryByIdUseCase: GetProductCategoryByIdUseCase;
  private readonly createProductCategoryUseCase: CreateProductCategoryUseCase;
  private readonly updateProductCategoryUseCase: UpdateProductCategoryUseCase;
  private readonly removeProductCategoryUseCase: RemoveProductCategoryUseCase;

  constructor(
    @Inject(COMMERCE_PRODUCT_CATEGORY_REPOSITORY_PORT)
    private readonly productCategoryRepositoryPort: ProductCategoryRepositoryPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
    private readonly localizationService: LocalizationService,
  ) {
    this.getProductCategoriesUseCase = new GetProductCategoriesUseCase(this.productCategoryRepositoryPort);
    this.getProductCategoryByIdUseCase = new GetProductCategoryByIdUseCase(this.productCategoryRepositoryPort);
    this.createProductCategoryUseCase = new CreateProductCategoryUseCase(this.productCategoryRepositoryPort);
    this.updateProductCategoryUseCase = new UpdateProductCategoryUseCase(this.productCategoryRepositoryPort);
    this.removeProductCategoryUseCase = new RemoveProductCategoryUseCase(this.productCategoryRepositoryPort);
  }

  async findAll(withProducts = true) {
    const context = this.tenantContextPort.getRequestContext();
    const categories = await this.getProductCategoriesUseCase.execute({
      context,
      withProducts,
    });
    const mapped = categories.map((category) => mapProductCategory(category, { includeProducts: withProducts }));
    const { items } = await this.localizationService.localizeCollection({
      context,
      entityType: 'product_category',
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

    if (withProducts) {
      const nestedProducts = items.flatMap((category) => category.products || []);
      await this.localizationService.localizeCollection({
        context,
        entityType: 'product',
        items: nestedProducts,
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

  async findOne(id: string, withProducts = true) {
    const context = this.tenantContextPort.getRequestContext();
    try {
      const category = await this.getProductCategoryByIdUseCase.execute({
        context,
        categoryId: id,
        withProducts,
      });
      const mapped = mapProductCategory(category, { includeProducts: withProducts });
      const localizedCategory = (
        await this.localizationService.localizeCollection({
          context,
          entityType: 'product_category',
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

      if (withProducts && localizedCategory?.products) {
        await this.localizationService.localizeCollection({
          context,
          entityType: 'product',
          items: localizedCategory.products,
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

  async create(data: CreateProductCategoryDto) {
    const context = this.tenantContextPort.getRequestContext();
    const created = await this.createProductCategoryUseCase.execute({
      context,
      name: data.name,
      description: data.description,
      position: data.position,
    });
    await this.localizationService.syncEntitySourceFields({
      context,
      entityType: 'product_category',
      entityId: created.id,
      fields: {
        name: created.name,
        description: created.description,
      },
    });
    return mapProductCategory(created, { includeProducts: false });
  }

  async update(id: string, data: UpdateProductCategoryDto) {
    const context = this.tenantContextPort.getRequestContext();
    try {
      const updated = await this.updateProductCategoryUseCase.execute({
        context,
        categoryId: id,
        name: data.name,
        description: data.description,
        position: data.position,
      });
      await this.localizationService.syncEntitySourceFields({
        context,
        entityType: 'product_category',
        entityId: updated.id,
        fields: {
          name: updated.name,
          description: updated.description,
        },
      });
      return mapProductCategory(updated, { includeProducts: false });
    } catch (error) {
      this.rethrowHttpError(error);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.removeProductCategoryUseCase.execute({
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
      PRODUCT_CATEGORY_NOT_FOUND: () => new NotFoundException('Category not found'),
      PRODUCT_CATEGORY_HAS_ASSIGNED_PRODUCTS: () =>
        new BadRequestException(
          'No puedes eliminar esta categoría mientras haya productos asignados y la categorización esté activa.',
        ),
    });
  }
}
