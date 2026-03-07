import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { CreateBarberUseCase } from '@/contexts/booking/application/use-cases/create-barber.use-case';
import { RemoveBarberUseCase } from '@/contexts/booking/application/use-cases/remove-barber.use-case';
import { UpdateBarberServiceAssignmentUseCase } from '@/contexts/booking/application/use-cases/update-barber-service-assignment.use-case';
import { UpdateBarberUseCase } from '@/contexts/booking/application/use-cases/update-barber.use-case';
import { DomainError } from '@/shared/domain/domain-error';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: 'admin-1',
  timezone: 'Europe/Madrid',
  correlationId: 'corr-booking-barbers-write-1',
};

test('create barber use case forwards scoped payload', async () => {
  const received: { params?: unknown } = {};
  const useCase = new CreateBarberUseCase({
    createBarber: async (params) => {
      received.params = params;
      return {
        id: 'barber-1',
        localId: 'local-1',
        name: 'Ana',
        photo: null,
        photoFileId: null,
        specialty: 'fade',
        role: 'worker',
        bio: null,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: null,
        isActive: true,
        calendarColor: null,
        userId: null,
        assignedServiceIds: [],
        assignedCategoryIds: [],
      };
    },
    updateBarber: async () => null,
    updateBarberServiceAssignment: async () => null,
    removeBarber: async () => null,
  });

  await useCase.execute({
    context: requestContext,
    name: 'Ana',
    specialty: 'fade',
    startDate: '2026-01-01',
  });

  assert.deepEqual(received.params, {
    localId: 'local-1',
    input: {
      name: 'Ana',
      photo: undefined,
      photoFileId: undefined,
      specialty: 'fade',
      role: undefined,
      bio: undefined,
      startDate: '2026-01-01',
      endDate: undefined,
      isActive: undefined,
      calendarColor: undefined,
      userId: undefined,
    },
  });
});

test('update barber use case throws BARBER_NOT_FOUND when target is missing', async () => {
  const useCase = new UpdateBarberUseCase({
    createBarber: async () => {
      throw new Error('not used');
    },
    updateBarber: async () => null,
    updateBarberServiceAssignment: async () => null,
    removeBarber: async () => null,
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

test('update barber service assignment use case throws BARBER_NOT_FOUND when target is missing', async () => {
  const useCase = new UpdateBarberServiceAssignmentUseCase({
    createBarber: async () => {
      throw new Error('not used');
    },
    updateBarber: async () => null,
    updateBarberServiceAssignment: async () => null,
    removeBarber: async () => null,
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

test('remove barber use case deletes photo file and returns archived flag', async () => {
  const photoDeletes: Array<{ barberId: string; fileId: string }> = [];
  const useCase = new RemoveBarberUseCase(
    {
      createBarber: async () => {
        throw new Error('not used');
      },
      updateBarber: async () => null,
      updateBarberServiceAssignment: async () => null,
      removeBarber: async () => ({ archived: true, photoFileId: 'img-123' }),
    },
    {
      deletePhotoFile: async (params) => {
        photoDeletes.push(params);
      },
    },
  );

  const result = await useCase.execute({
    context: requestContext,
    barberId: 'barber-1',
  });

  assert.deepEqual(result, { success: true, archived: true });
  assert.deepEqual(photoDeletes, [{ barberId: 'barber-1', fileId: 'img-123' }]);
});

test('remove barber use case returns BARBER_NOT_FOUND when management port cannot find target', async () => {
  const useCase = new RemoveBarberUseCase(
    {
      createBarber: async () => {
        throw new Error('not used');
      },
      updateBarber: async () => null,
      updateBarberServiceAssignment: async () => null,
      removeBarber: async () => null,
    },
    {
      deletePhotoFile: async () => undefined,
    },
  );

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        barberId: 'missing',
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'BARBER_NOT_FOUND',
  );
});
