import { RequestContext } from '../../../../shared/application/request-context';

export type UpdateProductCategoryCommand = {
  context: RequestContext;
  categoryId: string;
  name?: string;
  description?: string | null;
  position?: number;
};

