import { RequestContext } from '../../../../shared/application/request-context';

export type FindAppointmentByIdQuery = {
  context: RequestContext;
  appointmentId: string;
};
