import { RequestContext } from '../../../../shared/application/request-context';

export type GetServiceByIdQuery = {
  context: RequestContext;
  serviceId: string;
  includeArchived: boolean;
};
