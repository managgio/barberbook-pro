import { RequestContext } from '../../../../shared/application/request-context';

export type CreateServiceCommand = {
  context: RequestContext;
  name: string;
  description?: string;
  price: number;
  duration: number;
  categoryId?: string | null;
  position?: number;
};
