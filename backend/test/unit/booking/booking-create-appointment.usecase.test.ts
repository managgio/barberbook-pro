import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CreateAppointmentUseCase } from '@/contexts/booking/application/use-cases/create-appointment.use-case';

test('create appointment use case runs command through SERIALIZABLE unit of work', async () => {
  const received: {
    uowOptions?: unknown;
    command?: unknown;
  } = {};

  const useCase = new CreateAppointmentUseCase(
    {
      createAppointment: async (command) => {
        received.command = command;
        return { id: 'appointment-v2-1' };
      },
      updateAppointment: async () => ({ id: 'unused-update' }),
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
      actorUserId: null,
      timezone: 'Europe/Madrid',
      correlationId: 'corr-create-1',
    },
    input: {
      barberId: 'barber-1',
      serviceId: 'service-1',
      startDateTime: '2026-03-04T10:00:00.000Z',
    },
  };

  const result = await useCase.execute(command);

  assert.deepEqual(received.uowOptions, { isolationLevel: 'SERIALIZABLE' });
  assert.deepEqual(received.command, command);
  assert.deepEqual(result, { id: 'appointment-v2-1' });
});
