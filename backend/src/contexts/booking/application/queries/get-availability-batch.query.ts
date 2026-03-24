import { RequestContext } from '../../../../shared/application/request-context';

export type GetAvailabilityBatchQuery = {
  context: RequestContext;
  date: string;
  barberIds: string[];
  serviceId?: string;
  appointmentIdToIgnore?: string;
  slotIntervalMinutes?: number;
};
