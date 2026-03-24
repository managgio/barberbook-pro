import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductUseCase } from '../../contexts/commerce/application/use-cases/create-product.use-case';
import { GetProductsAdminUseCase } from '../../contexts/commerce/application/use-cases/get-products-admin.use-case';
import { GetProductsPublicUseCase } from '../../contexts/commerce/application/use-cases/get-products-public.use-case';
import { ImportProductsUseCase } from '../../contexts/commerce/application/use-cases/import-products.use-case';
import { RemoveProductUseCase } from '../../contexts/commerce/application/use-cases/remove-product.use-case';
import { UpdateProductUseCase } from '../../contexts/commerce/application/use-cases/update-product.use-case';
import {
  COMMERCE_PRODUCT_MANAGEMENT_PORT,
  CommerceProductManagementPort,
} from '../../contexts/commerce/ports/outbound/product-management.port';
import {
  COMMERCE_PRODUCT_MEDIA_STORAGE_PORT,
  CommerceProductMediaStoragePort,
} from '../../contexts/commerce/ports/outbound/product-media-storage.port';
import {
  COMMERCE_PRODUCT_READ_PORT,
  CommerceProductReadPort,
} from '../../contexts/commerce/ports/outbound/product-read.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { rethrowDomainErrorAsHttp } from '../../shared/interfaces/http/rethrow-domain-error-as-http';
import { LocalizationService } from '../localization/localization.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { mapProduct } from './products.mapper';

@Injectable()
export class ProductsService {
  private readonly getProductsAdminUseCase: GetProductsAdminUseCase;
  private readonly getProductsPublicUseCase: GetProductsPublicUseCase;
  private readonly createProductUseCase: CreateProductUseCase;
  private readonly updateProductUseCase: UpdateProductUseCase;
  private readonly removeProductUseCase: RemoveProductUseCase;
  private readonly importProductsUseCase: ImportProductsUseCase;

  constructor(
    @Inject(COMMERCE_PRODUCT_READ_PORT)
    private readonly productReadPort: CommerceProductReadPort,
    @Inject(COMMERCE_PRODUCT_MANAGEMENT_PORT)
    private readonly productManagementPort: CommerceProductManagementPort,
    @Inject(COMMERCE_PRODUCT_MEDIA_STORAGE_PORT)
    private readonly productMediaStoragePort: CommerceProductMediaStoragePort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
    private readonly localizationService: LocalizationService,
  ) {
    this.getProductsAdminUseCase = new GetProductsAdminUseCase(this.productReadPort);
    this.getProductsPublicUseCase = new GetProductsPublicUseCase(this.productReadPort);
    this.createProductUseCase = new CreateProductUseCase(this.productManagementPort, this.productReadPort);
    this.updateProductUseCase = new UpdateProductUseCase(this.productManagementPort, this.productReadPort);
    this.removeProductUseCase = new RemoveProductUseCase(this.productManagementPort, this.productMediaStoragePort);
    this.importProductsUseCase = new ImportProductsUseCase(this.productManagementPort);
  }

  async findAllAdmin() {
    const context = this.tenantContextPort.getRequestContext();
    const products = await this.getProductsAdminUseCase.execute({
      context,
    });
    const mapped = products.map((product) => mapProduct(product));
    const { items } = await this.localizationService.localizeCollection({
      context,
      entityType: 'product',
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
    return items;
  }

  async findPublic(context: 'landing' | 'booking' = 'booking') {
    const requestContext = this.tenantContextPort.getRequestContext();
    const products = await this.getProductsPublicUseCase.execute({
      context: requestContext,
      contextView: context,
    });
    const mapped = products.map((product) => mapProduct(product));
    const { items } = await this.localizationService.localizeCollection({
      context: requestContext,
      entityType: 'product',
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
    return items;
  }

  async create(data: CreateProductDto) {
    const context = this.tenantContextPort.getRequestContext();
    try {
      const product = await this.createProductUseCase.execute({
        context,
        name: data.name,
        description: data.description,
        sku: data.sku,
        price: data.price,
        position: data.position,
        stock: data.stock,
        minStock: data.minStock,
        categoryId: data.categoryId,
        imageUrl: data.imageUrl,
        imageFileId: data.imageFileId,
        isActive: data.isActive,
        isPublic: data.isPublic,
      });
      await this.localizationService.syncEntitySourceFields({
        context,
        entityType: 'product',
        entityId: product.id,
        fields: {
          name: product.name,
          description: product.description,
        },
      });
      return mapProduct(product);
    } catch (error) {
      rethrowDomainErrorAsHttp(error, {
        PRODUCTS_MODULE_DISABLED: () =>
          new BadRequestException('El control de productos no está habilitado en este local.'),
        PRODUCT_CATEGORY_REQUIRED_WHEN_ENABLED: () =>
          new BadRequestException('Debes asignar una categoría porque la categorización está activa.'),
        PRODUCT_CATEGORY_NOT_FOUND: () => new NotFoundException('Category not found'),
        PRODUCT_NOT_FOUND: () => new NotFoundException('Product not found'),
      });
      throw error;
    }
  }

  async update(id: string, data: UpdateProductDto) {
    const context = this.tenantContextPort.getRequestContext();
    try {
      const product = await this.updateProductUseCase.execute({
        context,
        productId: id,
        name: data.name,
        description: data.description,
        sku: data.sku,
        price: data.price,
        position: data.position,
        stock: data.stock,
        minStock: data.minStock,
        categoryId: data.categoryId,
        imageUrl: data.imageUrl,
        imageFileId: data.imageFileId,
        isActive: data.isActive,
        isPublic: data.isPublic,
      });
      await this.localizationService.syncEntitySourceFields({
        context,
        entityType: 'product',
        entityId: product.id,
        fields: {
          name: product.name,
          description: product.description,
        },
      });
      return mapProduct(product);
    } catch (error) {
      rethrowDomainErrorAsHttp(error, {
        PRODUCTS_MODULE_DISABLED: () =>
          new BadRequestException('El control de productos no está habilitado en este local.'),
        PRODUCT_CATEGORY_REQUIRED_WHEN_ENABLED: () =>
          new BadRequestException('Debes asignar una categoría porque la categorización está activa.'),
        PRODUCT_CATEGORY_NOT_FOUND: () => new NotFoundException('Category not found'),
        PRODUCT_NOT_FOUND: () => new NotFoundException('Product not found'),
      });
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.removeProductUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        productId: id,
      });
    } catch (error) {
      rethrowDomainErrorAsHttp(error, {
        PRODUCTS_MODULE_DISABLED: () =>
          new BadRequestException('El control de productos no está habilitado en este local.'),
        PRODUCT_NOT_FOUND: () => new NotFoundException('Product not found'),
      });
      throw error;
    }
  }

  async importFromLocal(sourceLocalId: string, targetLocalId?: string) {
    try {
      return await this.importProductsUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        sourceLocalId,
        targetLocalId,
      });
    } catch (error) {
      rethrowDomainErrorAsHttp(error, {
        LOCATION_NOT_FOUND: () => new NotFoundException('Local no encontrado.'),
        PRODUCT_IMPORT_CROSS_BRAND_FORBIDDEN: () =>
          new BadRequestException('Solo puedes importar productos entre locales de la misma marca.'),
        PRODUCT_IMPORT_TARGET_DISABLED: () =>
          new BadRequestException('El local destino no tiene habilitado el control de productos.'),
      });
      throw error;
    }
  }
}
