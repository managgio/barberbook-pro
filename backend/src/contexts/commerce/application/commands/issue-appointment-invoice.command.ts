import type { RequestContext } from '../../../../shared/application/request-context';

export type IssueAppointmentInvoiceCommand = {
  context: RequestContext;
  appointmentId: string;
  actorUserId: string | null;
};
