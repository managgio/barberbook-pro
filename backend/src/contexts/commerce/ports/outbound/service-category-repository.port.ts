import { ServiceCategoryEntity } from '../../domain/entities/service-category.entity';

export const COMMERCE_SERVICE_CATEGORY_REPOSITORY_PORT = Symbol('COMMERCE_SERVICE_CATEGORY_REPOSITORY_PORT');

export type CreateServiceCategoryInput = {
  localId: string;
  name: string;
  description: string;
  position: number;
};

export type UpdateServiceCategoryInput = {
  name?: string;
  description?: string | null;
  position?: number;
};

export interface ServiceCategoryRepositoryPort {
  listByLocalId(params: { localId: string; withServices: boolean }): Promise<ServiceCategoryEntity[]>;
  findByIdAndLocalId(params: { id: string; localId: string; withServices: boolean }): Promise<ServiceCategoryEntity | null>;
  create(input: CreateServiceCategoryInput): Promise<ServiceCategoryEntity>;
  updateById(id: string, input: UpdateServiceCategoryInput): Promise<ServiceCategoryEntity>;
  deleteById(id: string): Promise<void>;
  countAssignedServices(params: { localId: string; categoryId: string }): Promise<number>;
  areCategoriesEnabled(localId: string): Promise<boolean>;
}

