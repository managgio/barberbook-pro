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
  ) {
    this.getProductCategoriesUseCase = new GetProductCategoriesUseCase(this.productCategoryRepositoryPort);
    this.getProductCategoryByIdUseCase = new GetProductCategoryByIdUseCase(this.productCategoryRepositoryPort);
    this.createProductCategoryUseCase = new CreateProductCategoryUseCase(this.productCategoryRepositoryPort);
    this.updateProductCategoryUseCase = new UpdateProductCategoryUseCase(this.productCategoryRepositoryPort);
    this.removeProductCategoryUseCase = new RemoveProductCategoryUseCase(this.productCategoryRepositoryPort);
  }

  async findAll(withProducts = true) {
    const categories = await this.getProductCategoriesUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      withProducts,
    });
    return categories.map((category) => mapProductCategory(category, { includeProducts: withProducts }));
  }

  async findOne(id: string, withProducts = true) {
    try {
      const category = await this.getProductCategoryByIdUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        categoryId: id,
        withProducts,
      });
      return mapProductCategory(category, { includeProducts: withProducts });
    } catch (error) {
      this.rethrowHttpError(error);
      throw error;
    }
  }

  async create(data: CreateProductCategoryDto) {
    const created = await this.createProductCategoryUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      name: data.name,
      description: data.description,
      position: data.position,
    });
    return mapProductCategory(created, { includeProducts: false });
  }

  async update(id: string, data: UpdateProductCategoryDto) {
    try {
      const updated = await this.updateProductCategoryUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        categoryId: id,
        name: data.name,
        description: data.description,
        position: data.position,
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
