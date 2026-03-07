import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { SendAppointmentPaymentConfirmationUseCase } from '@/contexts/booking/application/use-cases/send-appointment-payment-confirmation.use-case';

test('send payment confirmation use case delegates to maintenance port with local scope', async () => {
  const calls: Array<{ appointmentId: string; localId: string }> = [];
  const useCase = new SendAppointmentPaymentConfirmationUseCase({
    syncStatusesForAllAppointments: async () => 0,
    syncStatusesForAppointments: async () => 0,
    sendPaymentConfirmation: async (params) => {
      calls.push(params);
    },
    anonymizeAppointment: async () => ({ success: true }),
  });

  await useCase.execute({
    context: {
      tenantId: 'tenant-1',
      brandId: 'brand-1',
      localId: 'local-1',
      actorUserId: null,
      timezone: 'Europe/Madrid',
      correlationId: 'corr-1',
    },
    appointmentId: 'appt-1',
  });

  assert.deepEqual(calls, [{ appointmentId: 'appt-1', localId: 'local-1' }]);
});
