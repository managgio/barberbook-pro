import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { GetBarberByIdUseCase } from '@/contexts/booking/application/use-cases/get-barber-by-id.use-case';
import { ListBarbersUseCase } from '@/contexts/booking/application/use-cases/list-barbers.use-case';
import { DomainError } from '@/shared/domain/domain-error';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: 'user-1',
  timezone: 'Europe/Madrid',
  correlationId: 'corr-booking-barbers-read-1',
};

test('list barbers use case forwards service filter and includeInactive with scoped localId', async () => {
  const received: { params?: unknown } = {};
  const useCase = new ListBarbersUseCase({
    listBarbers: async (params) => {
      received.params = params;
      return [];
    },
    getBarberById: async () => null,
  });

  await useCase.execute({
    context: requestContext,
    serviceId: 'service-1',
    includeInactive: true,
  });

  assert.deepEqual(received.params, {
    localId: 'local-1',
    serviceId: 'service-1',
    includeInactive: true,
  });
});

test('get barber by id use case throws BARBER_NOT_FOUND when barber is missing', async () => {
  const useCase = new GetBarberByIdUseCase({
    listBarbers: async () => [],
    getBarberById: async () => null,
  });

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        barberId: 'missing',
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'BARBER_NOT_FOUND',
  );
});
