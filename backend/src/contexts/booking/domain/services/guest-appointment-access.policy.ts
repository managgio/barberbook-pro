import { BookingGuestAppointmentRecord } from '../../ports/outbound/guest-appointment-read.port';

export type GuestAppointmentCancellationUnavailableReason =
  | 'already_cancelled'
  | 'appointment_not_scheduled'
  | 'appointment_started'
  | 'cancellation_cutoff_reached';

export type GuestAppointmentCancellationDecision =
  | { canCancel: true; reason: null }
  | { canCancel: false; reason: GuestAppointmentCancellationUnavailableReason };

export const evaluateGuestAppointmentCancellation = (params: {
  appointment: Pick<BookingGuestAppointmentRecord, 'status' | 'startDateTime'>;
  cancellationCutoffHours: number;
  now: Date;
}): GuestAppointmentCancellationDecision => {
  if (params.appointment.status === 'cancelled') {
    return { canCancel: false, reason: 'already_cancelled' };
  }
  if (params.appointment.status !== 'scheduled') {
    return { canCancel: false, reason: 'appointment_not_scheduled' };
  }

  const timeUntilStartMs = params.appointment.startDateTime.getTime() - params.now.getTime();
  if (timeUntilStartMs <= 0) {
    return { canCancel: false, reason: 'appointment_started' };
  }

  const cutoffHours = Math.max(0, params.cancellationCutoffHours);
  if (cutoffHours > 0 && timeUntilStartMs <= cutoffHours * 60 * 60 * 1000) {
    return { canCancel: false, reason: 'cancellation_cutoff_reached' };
  }

  return { canCancel: true, reason: null };
};
