import { RequestContext } from '../../../../shared/application/request-context';

export type CreateAppointmentProductInput = {
  productId: string;
  quantity: number;
};

export type CreateAppointmentPaymentInput = {
  status?: string;
  method?: string | null;
  amount?: number;
  currency?: string;
  expiresAt?: Date | null;
  stripePaymentIntentId?: string | null;
  stripeCheckoutSessionId?: string | null;
};

export type CreateAppointmentExecutionInput = {
  requireConsent?: boolean;
  ip?: string | null;
  userAgent?: string | null;
  actorUserId?: string | null;
  skipNotifications?: boolean;
  payment?: CreateAppointmentPaymentInput;
};

export type CreateAppointmentInput = {
  userId?: string | null;
  barberId: string;
  serviceId: string;
  startDateTime: string;
  status?: string;
  notes?: string;
  guestName?: string;
  guestContact?: string;
  privacyConsentGiven?: boolean;
  referralAttributionId?: string;
  appliedCouponId?: string;
  useWallet?: boolean;
  products?: CreateAppointmentProductInput[];
};

export type CreateAppointmentCommand = {
  context: RequestContext;
  input: CreateAppointmentInput;
  execution?: CreateAppointmentExecutionInput;
};
