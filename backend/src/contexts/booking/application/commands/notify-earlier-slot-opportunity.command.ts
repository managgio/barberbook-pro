import { RequestContext } from '../../../../shared/application/request-context';

export type NotifyEarlierSlotOpportunityCommand = {
  context: RequestContext;
  releasedAppointmentId: string;
  barberId: string;
  releasedStartDateTime: Date;
};
