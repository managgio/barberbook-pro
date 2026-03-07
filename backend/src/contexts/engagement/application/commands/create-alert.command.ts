import { RequestContext } from '../../../../shared/application/request-context';

export type CreateAlertCommand = {
  context: RequestContext;
  title: string;
  message: string;
  active?: boolean;
  type?: string;
  startDate?: string;
  endDate?: string;
};

