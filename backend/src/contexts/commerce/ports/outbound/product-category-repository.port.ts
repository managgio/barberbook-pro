import { ProductCategoryEntity } from '../../domain/entities/product-category.entity';

export const COMMERCE_PRODUCT_CATEGORY_REPOSITORY_PORT = Symbol('COMMERCE_PRODUCT_CATEGORY_REPOSITORY_PORT');

export type CreateProductCategoryInput = {
  localId: string;
  name: string;
  description: string;
  position: number;
};

export type UpdateProductCategoryInput = {
  name?: string;
  description?: string | null;
  position?: number;
};

export interface ProductCategoryRepositoryPort {
  listByLocalId(params: { localId: string; withProducts: boolean }): Promise<ProductCategoryEntity[]>;
  findByIdAndLocalId(params: { id: string; localId: string; withProducts: boolean }): Promise<ProductCategoryEntity | null>;
  create(input: CreateProductCategoryInput): Promise<ProductCategoryEntity>;
  updateById(id: string, input: UpdateProductCategoryInput): Promise<ProductCategoryEntity>;
  deleteById(id: string): Promise<void>;
  countAssignedProducts(params: { localId: string; categoryId: string }): Promise<number>;
  areCategoriesEnabled(params: { localId: string; brandId: string }): Promise<boolean>;
}

