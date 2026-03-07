export const COMMERCE_PRODUCT_MEDIA_STORAGE_PORT = Symbol('COMMERCE_PRODUCT_MEDIA_STORAGE_PORT');

export interface CommerceProductMediaStoragePort {
  deleteImageFile(params: { productId: string; fileId: string }): Promise<void>;
}
