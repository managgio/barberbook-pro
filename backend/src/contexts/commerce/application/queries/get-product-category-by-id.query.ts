import { RequestContext } from '../../../../shared/application/request-context';

export type GetProductCategoryByIdQuery = {
  context: RequestContext;
  categoryId: string;
  withProducts: boolean;
};

