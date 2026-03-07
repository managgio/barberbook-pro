import { RequestContext } from '../../../../shared/application/request-context';

export type GetBookingDashboardSummaryQuery = {
  context: RequestContext;
  windowDays?: number;
  barberId?: string;
};
