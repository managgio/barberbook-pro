export const BOOKING_IDEMPOTENCY_PORT = Symbol('BOOKING_IDEMPOTENCY_PORT');

export interface BookingIdempotencyPort {
  runOnce(key: string, work: () => Promise<void>): Promise<boolean>;
}
