import { RequestContext } from '../../../../shared/application/request-context';

export type RemoveAppointmentCommand = {
  context: RequestContext;
  appointmentId: string;
};
