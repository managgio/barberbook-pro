import { RequestContext } from '../../../../shared/application/request-context';

export type UpdateServiceCategoryCommand = {
  context: RequestContext;
  categoryId: string;
  name?: string;
  description?: string | null;
  position?: number;
};

