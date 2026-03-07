import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { RemoveAppointmentUseCase } from '@/contexts/booking/application/use-cases/remove-appointment.use-case';

test('remove appointment use case runs command through SERIALIZABLE unit of work', async () => {
  const received: {
    uowOptions?: unknown;
    command?: unknown;
  } = {};

  const useCase = new RemoveAppointmentUseCase(
    {
      createAppointment: async () => ({ id: 'unused-create' }),
      updateAppointment: async () => ({ id: 'unused-update' }),
      removeAppointment: async (command) => {
        received.command = command;
        return { success: true };
      },
    },
    {
      runInTransaction: async (work, options) => {
        received.uowOptions = options;
        return work();
      },
    },
  );

  const command = {
    context: {
      tenantId: 'tenant-1',
      brandId: 'brand-1',
      localId: 'local-1',
      actorUserId: null,
      timezone: 'Europe/Madrid',
      correlationId: 'corr-remove-1',
    },
    appointmentId: 'appointment-1',
  };

  const result = await useCase.execute(command);

  assert.deepEqual(received.uowOptions, { isolationLevel: 'SERIALIZABLE' });
  assert.deepEqual(received.command, command);
  assert.deepEqual(result, { success: true });
});
