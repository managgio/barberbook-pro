import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { HandleReferralAppointmentCancelledUseCase } from '@/contexts/engagement/application/use-cases/handle-referral-appointment-cancelled.use-case';

test('moves attribution back to ATTRIBUTED when appointment is cancelled before expiry', async () => {
  const updates: Array<Record<string, unknown>> = [];
  const persistence = {
    findAttributionByFirstAppointment: async () => ({
      id: 'attr-1',
      status: 'BOOKED',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      firstAppointmentId: 'apt-1',
      referrerUserId: 'user-ref',
      referredUserId: 'user-referred',
      referredEmail: 'guest@example.com',
      referredPhone: null,
    }),
    updateAttributionStatus: async (payload: Record<string, unknown>) => {
      updates.push(payload);
    },
  } as any;

  const useCase = new HandleReferralAppointmentCancelledUseCase(persistence);
  await useCase.execute({
    localId: 'local-1',
    appointmentId: 'apt-1',
    now: new Date('2026-03-04T12:00:00.000Z'),
  });

  assert.deepEqual(updates, [
    {
      attributionId: 'attr-1',
      status: 'ATTRIBUTED',
      firstAppointmentId: null,
    },
  ]);
});

test('expires attribution when appointment is cancelled after expiry', async () => {
  const updates: Array<Record<string, unknown>> = [];
  const persistence = {
    findAttributionByFirstAppointment: async () => ({
      id: 'attr-1',
      status: 'BOOKED',
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
      firstAppointmentId: 'apt-1',
      referrerUserId: 'user-ref',
      referredUserId: null,
      referredEmail: null,
      referredPhone: null,
    }),
    updateAttributionStatus: async (payload: Record<string, unknown>) => {
      updates.push(payload);
    },
  } as any;

  const useCase = new HandleReferralAppointmentCancelledUseCase(persistence);
  await useCase.execute({
    localId: 'local-1',
    appointmentId: 'apt-1',
    now: new Date('2026-03-04T12:00:00.000Z'),
  });

  assert.deepEqual(updates, [
    {
      attributionId: 'attr-1',
      status: 'EXPIRED',
      firstAppointmentId: null,
    },
  ]);
});
