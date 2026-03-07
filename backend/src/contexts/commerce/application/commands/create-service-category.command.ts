import { RequestContext } from '../../../../shared/application/request-context';

export type CreateServiceCategoryCommand = {
  context: RequestContext;
  name: string;
  description?: string | null;
  position?: number;
};

