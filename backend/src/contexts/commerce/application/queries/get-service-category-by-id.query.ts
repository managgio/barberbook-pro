import { RequestContext } from '../../../../shared/application/request-context';

export type GetServiceCategoryByIdQuery = {
  context: RequestContext;
  categoryId: string;
  withServices: boolean;
};

