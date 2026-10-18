export const BOOKING_GUEST_APPOINTMENT_ACCESS_TOKEN_PORT = Symbol(
  'BOOKING_GUEST_APPOINTMENT_ACCESS_TOKEN_PORT',
);

export type GuestAppointmentAccessScope = {
  brandId: string;
  localId: string;
};

export type GuestAppointmentTokenResolution =
  | { status: 'valid'; appointmentId: string }
  | { status: 'invalid' }
  | { status: 'unavailable' };

export interface GuestAppointmentAccessTokenPort {
  createToken(params: GuestAppointmentAccessScope & {
    appointmentId: string;
    expiresAt: Date;
  }): string | null;
  resolveToken(params: GuestAppointmentAccessScope & { token: string }): GuestAppointmentTokenResolution;
}
