import { RequestContext } from '../../../../shared/application/request-context';

export type AnonymizeAppointmentCommand = {
  context: RequestContext;
  appointmentId: string;
  actorUserId?: string | null;
  reason?: string;
};
