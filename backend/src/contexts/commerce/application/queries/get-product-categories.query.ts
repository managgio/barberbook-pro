import { RequestContext } from '../../../../shared/application/request-context';

export type GetProductCategoriesQuery = {
  context: RequestContext;
  withProducts: boolean;
};

