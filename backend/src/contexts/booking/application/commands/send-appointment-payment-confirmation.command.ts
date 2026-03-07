import { RequestContext } from '../../../../shared/application/request-context';

export type SendAppointmentPaymentConfirmationCommand = {
  context: RequestContext;
  appointmentId: string;
};
