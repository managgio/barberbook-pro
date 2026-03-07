import { CommerceProductReadModel } from '../../domain/entities/product-read.entity';

export const COMMERCE_PRODUCT_READ_PORT = Symbol('COMMERCE_PRODUCT_READ_PORT');

export interface CommerceProductReadPort {
  listAdminProducts(params: { localId: string; brandId: string }): Promise<CommerceProductReadModel[]>;
  listPublicProducts(params: {
    localId: string;
    brandId: string;
    context: 'landing' | 'booking';
  }): Promise<CommerceProductReadModel[]>;
  getProductById(params: {
    localId: string;
    brandId: string;
    productId: string;
    includeArchived: boolean;
  }): Promise<CommerceProductReadModel | null>;
}
