import { AppointmentStatus } from '@/data/types';
import { GuestAppointmentCancellationUnavailableReason } from '@/data/api/guestAppointmentAccess';

export type GuestAppointmentStatusTone = 'pending' | 'success' | 'danger' | 'muted';

export const getGuestAppointmentStatusTone = (
  status: AppointmentStatus,
): GuestAppointmentStatusTone => {
  if (status === 'scheduled') return 'pending';
  if (status === 'completed') return 'success';
  if (status === 'cancelled') return 'danger';
  return 'muted';
};

export const getGuestAppointmentStatusTranslationKey = (status: AppointmentStatus) =>
  `guestAppointment.status.${status}`;

export const getCancellationReasonTranslationKey = (
  reason: GuestAppointmentCancellationUnavailableReason | null,
) => reason ? `guestAppointment.cancellation.reason.${reason}` : null;

export const formatGuestAppointmentDateTime = (params: {
  value: string;
  locale: string;
  timezone?: string | null;
}) => {
  const date = new Date(params.value);
  if (Number.isNaN(date.getTime())) return null;

  const options: Intl.DateTimeFormatOptions = {
    dateStyle: 'full',
    timeStyle: 'short',
    ...(params.timezone ? { timeZone: params.timezone } : {}),
  };

  try {
    return new Intl.DateTimeFormat(params.locale, options).format(date);
  } catch {
    return new Intl.DateTimeFormat(params.locale, {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(date);
  }
};
