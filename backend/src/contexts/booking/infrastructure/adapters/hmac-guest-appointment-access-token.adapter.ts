import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  GuestAppointmentAccessTokenPort,
  GuestAppointmentTokenResolution,
} from '../../ports/outbound/guest-appointment-access-token.port';

const TOKEN_VERSION = 'v1';
const SIGNATURE_BYTES = 16;
const MINIMUM_SECRET_BYTES = 32;
const APPOINTMENT_ID_PATTERN = /^[A-Za-z0-9_-]{10,191}$/;
const TOKEN_PATTERN = /^v1\.([A-Za-z0-9_-]{10,191})\.([0-9a-z]{1,12})\.([A-Za-z0-9_-]{22})$/;

export class HmacGuestAppointmentAccessTokenAdapter implements GuestAppointmentAccessTokenPort {
  private readonly secret: Buffer | null;
  private readonly now: () => Date;

  constructor(params: { secret?: string | null; production?: boolean; now?: () => Date }) {
    const candidate = params.secret?.trim() || '';
    this.secret = Buffer.byteLength(candidate, 'utf8') >= MINIMUM_SECRET_BYTES
      ? Buffer.from(candidate, 'utf8')
      : null;
    if (params.production && !this.secret) {
      throw new Error(
        `GUEST_APPOINTMENT_LINK_SECRET must contain at least ${MINIMUM_SECRET_BYTES} bytes in production.`,
      );
    }
    this.now = params.now || (() => new Date());
  }

  createToken(params: {
    brandId: string;
    localId: string;
    appointmentId: string;
    expiresAt: Date;
  }): string | null {
    if (!this.secret || !APPOINTMENT_ID_PATTERN.test(params.appointmentId)) return null;
    const expiresAtSeconds = Math.floor(params.expiresAt.getTime() / 1000);
    const nowSeconds = Math.floor(this.now().getTime() / 1000);
    if (!Number.isSafeInteger(expiresAtSeconds) || expiresAtSeconds <= nowSeconds) return null;
    const expiration = expiresAtSeconds.toString(36);
    const signature = this.sign({ ...params, expiration });
    return `${TOKEN_VERSION}.${params.appointmentId}.${expiration}.${signature}`;
  }

  resolveToken(params: {
    brandId: string;
    localId: string;
    token: string;
  }): GuestAppointmentTokenResolution {
    if (!this.secret) return { status: 'unavailable' };
    if (params.token.length > 240) return { status: 'invalid' };
    const match = TOKEN_PATTERN.exec(params.token);
    if (!match) return { status: 'invalid' };
    const appointmentId = match[1];
    const expiration = match[2];
    const suppliedSignature = match[3];
    const expectedSignature = this.sign({ ...params, appointmentId, expiration });
    const suppliedBuffer = Buffer.from(suppliedSignature, 'base64url');
    const expectedBuffer = Buffer.from(expectedSignature, 'base64url');
    if (
      suppliedBuffer.length !== expectedBuffer.length
      || !timingSafeEqual(suppliedBuffer, expectedBuffer)
    ) {
      return { status: 'invalid' };
    }
    const expiresAtSeconds = Number.parseInt(expiration, 36);
    const nowSeconds = Math.floor(this.now().getTime() / 1000);
    if (!Number.isSafeInteger(expiresAtSeconds) || expiresAtSeconds <= nowSeconds) {
      return { status: 'invalid' };
    }
    return { status: 'valid', appointmentId };
  }

  private sign(params: {
    brandId: string;
    localId: string;
    appointmentId: string;
    expiration: string;
  }) {
    return createHmac('sha256', this.secret!)
      .update(
        `${TOKEN_VERSION}\n${params.brandId}\n${params.localId}\n${params.appointmentId}\n${params.expiration}`,
        'utf8',
      )
      .digest()
      .subarray(0, SIGNATURE_BYTES)
      .toString('base64url');
  }
}
