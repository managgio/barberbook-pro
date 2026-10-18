import { RequestContext } from '../../../../shared/application/request-context';
import {
  GuestAppointmentAccessNotFoundError,
  GuestAppointmentAccessUnavailableError,
} from '../errors/guest-appointment-access.errors';
import { evaluateGuestAppointmentCancellation } from '../../domain/services/guest-appointment-access.policy';
import {
  BookingGuestAppointmentReadPort,
  BookingGuestAppointmentRecord,
} from '../../ports/outbound/guest-appointment-read.port';
import { GuestAppointmentAccessTokenPort } from '../../ports/outbound/guest-appointment-access-token.port';

export type GuestAppointmentAccessSummary = {
  status: BookingGuestAppointmentRecord['status'];
  startDateTime: string;
  durationMinutes: number;
  serviceName: string;
  professionalName: string | null;
  timezone: string;
  canCancel: boolean;
  cancellationUnavailableReason: ReturnType<typeof evaluateGuestAppointmentCancellation>['reason'];
};

export const resolveGuestAppointment = async (params: {
  context: RequestContext;
  token: string;
  tokenPort: GuestAppointmentAccessTokenPort;
  readPort: BookingGuestAppointmentReadPort;
}) => {
  const tokenResolution = params.tokenPort.resolveToken({
    token: params.token,
    brandId: params.context.brandId,
    localId: params.context.localId,
  });
  if (tokenResolution.status === 'unavailable') {
    throw new GuestAppointmentAccessUnavailableError();
  }
  if (tokenResolution.status !== 'valid') {
    throw new GuestAppointmentAccessNotFoundError();
  }

  const appointment = await params.readPort.findGuestAppointment({
    localId: params.context.localId,
    appointmentId: tokenResolution.appointmentId,
  });
  if (!appointment) {
    throw new GuestAppointmentAccessNotFoundError();
  }
  return appointment;
};

export const buildGuestAppointmentSummary = (params: {
  appointment: BookingGuestAppointmentRecord;
  cancellationCutoffHours: number;
  now: Date;
  timezone: string;
}): GuestAppointmentAccessSummary => {
  const cancellation = evaluateGuestAppointmentCancellation({
    appointment: params.appointment,
    cancellationCutoffHours: params.cancellationCutoffHours,
    now: params.now,
  });
  return {
    status: params.appointment.status,
    startDateTime: params.appointment.startDateTime.toISOString(),
    durationMinutes: params.appointment.durationMinutes,
    serviceName: params.appointment.serviceName,
    professionalName: params.appointment.professionalName,
    timezone: params.timezone,
    canCancel: cancellation.canCancel,
    cancellationUnavailableReason: cancellation.reason,
  };
};
