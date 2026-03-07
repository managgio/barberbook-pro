import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { UpdateAppointmentUseCase } from '@/contexts/booking/application/use-cases/update-appointment.use-case';

test('update appointment use case runs command through SERIALIZABLE unit of work', async () => {
  const received: {
    uowOptions?: unknown;
    command?: unknown;
  } = {};

  const useCase = new UpdateAppointmentUseCase(
    {
      createAppointment: async () => ({ id: 'unused-create' }),
      updateAppointment: async (command) => {
        received.command = command;
        return { id: 'appointment-v2-1', status: 'cancelled' };
      },
      removeAppointment: async () => ({ success: true }),
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
      actorUserId: 'admin-1',
      timezone: 'Europe/Madrid',
      correlationId: 'corr-update-1',
    },
    appointmentId: 'appointment-1',
    input: {
      status: 'cancelled',
    },
  };

  const result = await useCase.execute(command);

  assert.deepEqual(received.uowOptions, { isolationLevel: 'SERIALIZABLE' });
  assert.deepEqual(received.command, command);
  assert.deepEqual(result, { id: 'appointment-v2-1', status: 'cancelled' });
});
