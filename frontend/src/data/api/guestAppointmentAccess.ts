import { AppointmentStatus } from '@/data/types';

import { apiRequest } from './request';

export type GuestAppointmentCancellationUnavailableReason =
  | 'already_cancelled'
  | 'appointment_not_scheduled'
  | 'appointment_started'
  | 'cancellation_cutoff_reached';

export type GuestAppointmentAccessSummary = {
  status: AppointmentStatus;
  startDateTime: string;
  durationMinutes: number;
  serviceName: string;
  professionalName: string | null;
  timezone: string;
  canCancel: boolean;
  cancellationUnavailableReason: GuestAppointmentCancellationUnavailableReason | null;
};

export const getGuestAppointmentAccess = async (
  token: string,
): Promise<GuestAppointmentAccessSummary> =>
  apiRequest(`/appointments/guest-access/${encodeURIComponent(token)}`);

export const cancelGuestAppointment = async (
  token: string,
): Promise<GuestAppointmentAccessSummary> =>
  apiRequest(`/appointments/guest-access/${encodeURIComponent(token)}/cancel`, {
    method: 'POST',
  });
