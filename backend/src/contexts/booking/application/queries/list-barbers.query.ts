import { RequestContext } from '../../../../shared/application/request-context';

export type ListBarbersQuery = {
  context: RequestContext;
  serviceId?: string;
  includeInactive?: boolean;
};
