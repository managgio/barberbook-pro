import { RequestContext } from '../../../../shared/application/request-context';

export type GetAlertsQuery = {
  context: RequestContext;
  onlyActive?: boolean;
  now?: Date;
};

