import { RequestContext } from '../../../../shared/application/request-context';

export type GetAvailableDaysQuery = {
  context: RequestContext;
  dateFrom: string;
  dateTo: string;
  barberIds: string[];
  serviceIds: string[];
  slotIntervalMinutes?: number;
};
