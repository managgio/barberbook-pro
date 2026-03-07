import { RequestContext } from '../../../../shared/application/request-context';

export type UpdateAlertCommand = {
  context: RequestContext;
  alertId: string;
  title?: string;
  message?: string;
  active?: boolean;
  type?: string;
  startDate?: string;
  endDate?: string;
};

