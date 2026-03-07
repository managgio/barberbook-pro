import { RequestContext } from '../../../../shared/application/request-context';

export type GetWeeklyLoadQuery = {
  context: RequestContext;
  dateFrom: string;
  dateTo: string;
  barberIds?: string[];
};
