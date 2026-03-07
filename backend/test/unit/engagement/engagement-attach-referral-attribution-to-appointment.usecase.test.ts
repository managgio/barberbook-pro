import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { AttachReferralAttributionToAppointmentUseCase } from '@/contexts/engagement/application/use-cases/attach-referral-attribution-to-appointment.use-case';

test('skips attaching when attribution is expired or already linked to another appointment', async () => {
  const calls: string[] = [];
  const persistence = {
    findAttributionById: async () => ({
      id: 'attr-1',
      status: 'BOOKED',
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
      firstAppointmentId: 'apt-other',
      referrerUserId: 'ref-1',
      referredUserId: null,
      referredEmail: null,
      referredPhone: null,
    }),
    findLatestPendingAttributionByUser: async () => null,
    findLatestPendingAttributionByContact: async () => null,
    getActiveReferralConfig: async () => ({ antiFraud: { blockSelfByUser: true, blockSelfByContact: true } }),
    getUserContact: async () => ({ email: 'referrer@example.com', phone: null }),
    markAttributionBooked: async () => {
      calls.push('markAttributionBooked');
    },
  } as any;
  const useCase = new AttachReferralAttributionToAppointmentUseCase(persistence);

  await useCase.execute({
    localId: 'local-1',
    attributionId: 'attr-1',
    appointmentId: 'apt-1',
    guestContact: 'guest@example.com',
    now: new Date('2026-03-04T10:00:00.000Z'),
  });

  assert.equal(calls.length, 0);
});

test('marks attribution as booked when anti-fraud checks pass', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const persistence = {
    findAttributionById: async () => ({
      id: 'attr-1',
      status: 'ATTRIBUTED',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      firstAppointmentId: null,
      referrerUserId: 'ref-1',
      referredUserId: null,
      referredEmail: null,
      referredPhone: null,
    }),
    findLatestPendingAttributionByUser: async () => null,
    findLatestPendingAttributionByContact: async () => null,
    getActiveReferralConfig: async () => ({ antiFraud: { blockSelfByUser: true, blockSelfByContact: true } }),
    getUserContact: async () => ({ email: 'referrer@example.com', phone: '+341234' }),
    markAttributionBooked: async (payload: Record<string, unknown>) => {
      calls.push(payload);
    },
  } as any;
  const useCase = new AttachReferralAttributionToAppointmentUseCase(persistence);

  await useCase.execute({
    localId: 'local-1',
    attributionId: 'attr-1',
    appointmentId: 'apt-1',
    userId: 'user-1',
    guestContact: 'guest@example.com',
    now: new Date('2026-03-04T10:00:00.000Z'),
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    attributionId: 'attr-1',
    appointmentId: 'apt-1',
    referredUserId: 'user-1',
    referredEmail: 'guest@example.com',
    referredPhone: null,
    tx: undefined,
  });
});
