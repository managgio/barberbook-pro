import {
  AdminStripeConfig,
  AdminStripeToggleResponse,
  CreateAppointmentPayload,
  StripeAvailability,
  StripeCheckoutResponse,
  StripeOnboardingResponse,
  StripeSessionResponse,
} from '@/data/types';

import { apiRequest } from './request';

export const getStripeAvailability = async (): Promise<StripeAvailability> =>
  apiRequest('/payments/stripe/availability');

export const createStripeCheckout = async (data: CreateAppointmentPayload): Promise<StripeCheckoutResponse> =>
  apiRequest('/payments/stripe/checkout', { method: 'POST', body: data });

export const getStripeSession = async (sessionId: string): Promise<StripeSessionResponse> =>
  apiRequest(`/payments/stripe/session/${sessionId}`);

export const getAdminStripeConfig = async (): Promise<AdminStripeConfig> =>
  apiRequest('/admin/payments/stripe/config');

export const updateAdminStripeConfig = async (enabled: boolean): Promise<AdminStripeToggleResponse> =>
  apiRequest('/admin/payments/stripe/config', { method: 'PUT', body: { enabled } });

export const createAdminStripeConnect = async (): Promise<StripeOnboardingResponse> =>
  apiRequest('/admin/payments/stripe/connect', { method: 'POST' });
