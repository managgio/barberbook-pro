import { RequestContext } from '../../../../shared/application/request-context';

export type RemoveServiceCategoryCommand = {
  context: RequestContext;
  categoryId: string;
};

