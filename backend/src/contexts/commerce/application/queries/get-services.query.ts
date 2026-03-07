import { RequestContext } from '../../../../shared/application/request-context';

export type GetServicesQuery = {
  context: RequestContext;
  includeArchived: boolean;
};
