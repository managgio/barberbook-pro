import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { SyncAppointmentStatusesUseCase } from '@/contexts/booking/application/use-cases/sync-appointment-statuses.use-case';

test('sync appointment statuses use case delegates to maintenance port', async () => {
  let called = 0;
  const useCase = new SyncAppointmentStatusesUseCase({
    syncStatusesForAllAppointments: async () => {
      called += 1;
      return 7;
    },
    syncStatusesForAppointments: async () => 0,
    sendPaymentConfirmation: async () => undefined,
    anonymizeAppointment: async () => ({ id: 'unused' }),
  });

  const result = await useCase.execute();

  assert.equal(called, 1);
  assert.equal(result, 7);
});
