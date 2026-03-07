import { RequestContext } from '../../../../shared/application/request-context';

export type UpdateProductCommand = {
  context: RequestContext;
  productId: string;
  name?: string;
  description?: string;
  sku?: string;
  price?: number;
  stock?: number;
  minStock?: number;
  categoryId?: string | null;
  imageUrl?: string | null;
  imageFileId?: string | null;
  isActive?: boolean;
  isPublic?: boolean;
};
