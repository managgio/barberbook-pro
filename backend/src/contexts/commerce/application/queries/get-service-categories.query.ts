import { RequestContext } from '../../../../shared/application/request-context';

export type GetServiceCategoriesQuery = {
  context: RequestContext;
  withServices: boolean;
};

