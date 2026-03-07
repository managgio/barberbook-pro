import { RequestContext } from '../../../../shared/application/request-context';

export type RemoveAlertCommand = {
  context: RequestContext;
  alertId: string;
};

