import { RequestContext } from '../../../../shared/application/request-context';

export type GetAvailabilityQuery = {
  context: RequestContext;
  barberId: string;
  date: string;
  serviceId?: string;
  appointmentIdToIgnore?: string;
};
