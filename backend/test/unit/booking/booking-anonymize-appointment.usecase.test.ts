import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { AnonymizeAppointmentUseCase } from '@/contexts/booking/application/use-cases/anonymize-appointment.use-case';

test('anonymize appointment use case delegates to maintenance port', async () => {
  let received: any;
  const useCase = new AnonymizeAppointmentUseCase({
    syncStatusesForAllAppointments: async () => 0,
    syncStatusesForAppointments: async () => 0,
    sendPaymentConfirmation: async () => undefined,
    anonymizeAppointment: async (params) => {
      received = params;
      return { success: true };
    },
  });

  const result = await useCase.execute({
    context: {
      tenantId: 'tenant-1',
      brandId: 'brand-1',
      localId: 'local-1',
      actorUserId: null,
      timezone: 'Europe/Madrid',
      correlationId: 'corr-anon-1',
    },
    appointmentId: 'app-1',
    reason: 'retention',
  });

  assert.deepEqual(received, {
    appointmentId: 'app-1',
    actorUserId: undefined,
    reason: 'retention',
  });
  assert.deepEqual(result, { success: true });
});
