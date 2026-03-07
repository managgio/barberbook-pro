import { RequestContext } from '../../../../shared/application/request-context';

export type CreateProductCategoryCommand = {
  context: RequestContext;
  name: string;
  description?: string | null;
  position?: number;
};

