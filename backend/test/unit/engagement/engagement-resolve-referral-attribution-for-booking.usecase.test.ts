import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  ResolveReferralAttributionForBookingError,
  ResolveReferralAttributionForBookingUseCase,
} from '@/contexts/engagement/application/use-cases/resolve-referral-attribution-for-booking.use-case';

test('throws invalid attribution error when explicit attribution id does not exist', async () => {
  const persistence = {
    findAttributionById: async () => null,
    findLatestPendingAttributionByUser: async () => null,
    findLatestPendingAttributionByContact: async () => null,
    getActiveReferralConfig: async () => null,
    getUserContact: async () => null,
    markAttributionBooked: async () => undefined,
  } as any;
  const useCase = new ResolveReferralAttributionForBookingUseCase(persistence);

  await assert.rejects(
    () =>
      useCase.execute({
        localId: 'local-1',
        referralAttributionId: 'attr-1',
      }),
    (error: unknown) =>
      error instanceof ResolveReferralAttributionForBookingError &&
      error.code === 'INVALID_ATTRIBUTION' &&
      error.message === 'La atribución del referido no es válida.',
  );
});

test('resolves latest pending attribution by user and guest contact', async () => {
  const persistence = {
    findAttributionById: async () => null,
    findLatestPendingAttributionByUser: async () => ({
      id: 'attr-by-user',
      status: 'ATTRIBUTED',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      firstAppointmentId: null,
      referrerUserId: 'ref-1',
      referredUserId: 'usr-1',
      referredEmail: null,
      referredPhone: null,
    }),
    findLatestPendingAttributionByContact: async () => ({
      id: 'attr-by-contact',
      status: 'BOOKED',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      firstAppointmentId: null,
      referrerUserId: 'ref-1',
      referredUserId: null,
      referredEmail: 'guest@example.com',
      referredPhone: null,
    }),
    getActiveReferralConfig: async () => null,
    getUserContact: async () => null,
    markAttributionBooked: async () => undefined,
  } as any;
  const useCase = new ResolveReferralAttributionForBookingUseCase(persistence);

  assert.deepEqual(
    await useCase.execute({
      localId: 'local-1',
      userId: 'usr-1',
      now: new Date('2026-03-04T10:00:00.000Z'),
    }),
    { id: 'attr-by-user' },
  );

  assert.deepEqual(
    await useCase.execute({
      localId: 'local-1',
      guestContact: 'guest@example.com',
      now: new Date('2026-03-04T10:00:00.000Z'),
    }),
    { id: 'attr-by-contact' },
  );
});
