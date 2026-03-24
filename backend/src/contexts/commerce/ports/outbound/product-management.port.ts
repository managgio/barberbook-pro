export const COMMERCE_PRODUCT_MANAGEMENT_PORT = Symbol('COMMERCE_PRODUCT_MANAGEMENT_PORT');

export type ProductSettingsScope = {
  localId: string;
  brandId: string;
};

export type CommerceProductForManagement = {
  id: string;
  categoryId: string | null;
  position: number;
  imageFileId: string | null;
};

export type CreateCommerceProductInput = {
  name: string;
  description: string;
  sku: string | null;
  price: number;
  position: number;
  stock: number;
  minStock: number;
  categoryId: string | null;
  imageUrl: string | null;
  imageFileId: string | null;
  isActive: boolean;
  isPublic: boolean;
};

export type UpdateCommerceProductInput = {
  name?: string;
  description?: string;
  sku?: string | null;
  price?: number;
  position?: number;
  stock?: number;
  minStock?: number;
  categoryId: string | null;
  imageUrl?: string | null;
  imageFileId?: string | null;
  isActive?: boolean;
  isPublic?: boolean;
};

export interface CommerceProductManagementPort {
  areProductsEnabled(scope: ProductSettingsScope): Promise<boolean>;
  areCategoriesEnabled(scope: ProductSettingsScope): Promise<boolean>;
  categoryExists(params: { localId: string; categoryId: string }): Promise<boolean>;
  findActiveProductById(params: {
    localId: string;
    productId: string;
  }): Promise<CommerceProductForManagement | null>;
  findActiveProductByNormalizedName(params: {
    localId: string;
    normalizedName: string;
  }): Promise<{ id: string } | null>;
  getNextProductPosition(params: {
    localId: string;
    categoryId: string | null;
  }): Promise<number>;
  createProduct(params: {
    localId: string;
    input: CreateCommerceProductInput;
  }): Promise<{ id: string }>;
  updateProduct(params: {
    localId: string;
    productId: string;
    input: UpdateCommerceProductInput;
  }): Promise<{ id: string } | null>;
  countAppointmentUsages(productId: string): Promise<number>;
  archiveProduct(params: { localId: string; productId: string }): Promise<void>;
  deleteProduct(params: { localId: string; productId: string }): Promise<void>;
  findLocationsByIds(localIds: string[]): Promise<Array<{ id: string; brandId: string }>>;
  importProducts(params: {
    sourceLocalId: string;
    destinationLocalId: string;
  }): Promise<{ created: number; updated: number }>;
}
