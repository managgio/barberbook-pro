export const COMMERCE_SERVICE_MANAGEMENT_PORT = Symbol('COMMERCE_SERVICE_MANAGEMENT_PORT');

export type CreateCommerceServiceInput = {
  name: string;
  description: string;
  price: number;
  duration: number;
  categoryId: string | null;
};

export type UpdateCommerceServiceInput = {
  name?: string;
  description?: string;
  price?: number;
  duration?: number;
  categoryId: string | null;
};

export type CommerceServiceForManagement = {
  id: string;
  categoryId: string | null;
  isArchived: boolean;
};

export type ArchiveCommerceServiceResult = 'not_found' | 'already_archived' | 'archived';

export interface CommerceServiceManagementPort {
  areCategoriesEnabled(localId: string): Promise<boolean>;
  categoryExists(params: { localId: string; categoryId: string }): Promise<boolean>;
  findServiceForManagement(params: {
    localId: string;
    serviceId: string;
    includeArchived?: boolean;
  }): Promise<CommerceServiceForManagement | null>;
  createService(params: {
    localId: string;
    input: CreateCommerceServiceInput;
  }): Promise<{ id: string }>;
  updateService(params: {
    localId: string;
    serviceId: string;
    input: UpdateCommerceServiceInput;
  }): Promise<{ id: string } | null>;
  archiveService(params: {
    localId: string;
    serviceId: string;
  }): Promise<ArchiveCommerceServiceResult>;
}
