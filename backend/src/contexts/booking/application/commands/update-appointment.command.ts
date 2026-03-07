import { RequestContext } from '../../../../shared/application/request-context';
import { CreateAppointmentPaymentInput } from './create-appointment.command';

export type UpdateAppointmentInput = {
  userId?: string | null;
  barberId?: string;
  serviceId?: string;
  startDateTime?: string;
  status?: string;
  notes?: string;
  guestName?: string;
  guestContact?: string;
  price?: number;
  paymentMethod?: string | null;
  referralAttributionId?: string | null;
  appliedCouponId?: string | null;
  walletAppliedAmount?: number;
  products?: Array<{ productId: string; quantity: number }>;
};

export type UpdateAppointmentExecutionInput = {
  actorUserId?: string | null;
  payment?: CreateAppointmentPaymentInput;
};

export type UpdateAppointmentCommand = {
  context: RequestContext;
  appointmentId: string;
  input: UpdateAppointmentInput;
  execution?: UpdateAppointmentExecutionInput;
};
