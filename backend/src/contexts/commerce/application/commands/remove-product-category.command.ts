import { RequestContext } from '../../../../shared/application/request-context';

export type RemoveProductCategoryCommand = {
  context: RequestContext;
  categoryId: string;
};

