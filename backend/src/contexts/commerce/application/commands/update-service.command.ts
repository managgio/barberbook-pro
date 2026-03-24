import { RequestContext } from '../../../../shared/application/request-context';

export type UpdateServiceCommand = {
  context: RequestContext;
  serviceId: string;
  name?: string;
  description?: string;
  price?: number;
  duration?: number;
  categoryId?: string | null;
  position?: number;
};
