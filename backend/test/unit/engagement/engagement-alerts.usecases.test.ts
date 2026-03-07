import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { CreateAlertUseCase } from '@/contexts/engagement/application/use-cases/create-alert.use-case';
import { RemoveAlertUseCase } from '@/contexts/engagement/application/use-cases/remove-alert.use-case';
import { UpdateAlertUseCase } from '@/contexts/engagement/application/use-cases/update-alert.use-case';
import { DomainError } from '@/shared/domain/domain-error';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: 'user-1',
  timezone: 'Europe/Madrid',
  correlationId: 'corr-engagement-alerts-1',
};

test('create alert use case sets active/type defaults and parses date range', async () => {
  const received: { input?: unknown } = {};
  const useCase = new CreateAlertUseCase({
    listByLocalId: async () => [],
    listActiveByLocalId: async () => [],
    create: async (input) => {
      received.input = input;
      return {
        id: 'alert-1',
        localId: input.localId,
        title: input.title,
        message: input.message,
        active: input.active,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
      };
    },
    findByIdAndLocalId: async () => null,
    updateById: async () => {
      throw new Error('not used');
    },
    deleteById: async () => undefined,
  });

  const created = await useCase.execute({
    context: requestContext,
    title: 'Title',
    message: 'Message',
    startDate: '2026-03-04T10:00:00.000Z',
    endDate: '2026-03-04T11:00:00.000Z',
  });

  assert.deepEqual(received.input, {
    localId: 'local-1',
    title: 'Title',
    message: 'Message',
    active: true,
    type: 'info',
    startDate: new Date('2026-03-04T10:00:00.000Z'),
    endDate: new Date('2026-03-04T11:00:00.000Z'),
  });
  assert.equal(created.id, 'alert-1');
});

test('create alert use case throws ALERT_INVALID_DATE_RANGE when start is after end', () => {
  const useCase = new CreateAlertUseCase({
    listByLocalId: async () => [],
    listActiveByLocalId: async () => [],
    create: async () => {
      throw new Error('not used');
    },
    findByIdAndLocalId: async () => null,
    updateById: async () => {
      throw new Error('not used');
    },
    deleteById: async () => undefined,
  });

  assert.throws(
    () =>
      useCase.execute({
        context: requestContext,
        title: 'Title',
        message: 'Message',
        startDate: '2026-03-04T12:00:00.000Z',
        endDate: '2026-03-04T11:00:00.000Z',
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'ALERT_INVALID_DATE_RANGE',
  );
});

test('update/remove alert use cases throw ALERT_NOT_FOUND when tenant-scoped record is missing', async () => {
  const repository = {
    listByLocalId: async () => [],
    listActiveByLocalId: async () => [],
    create: async () => {
      throw new Error('not used');
    },
    findByIdAndLocalId: async () => null,
    updateById: async () => {
      throw new Error('not used');
    },
    deleteById: async () => undefined,
  };

  const updateUseCase = new UpdateAlertUseCase(repository);
  const removeUseCase = new RemoveAlertUseCase(repository);

  await assert.rejects(
    () =>
      updateUseCase.execute({
        context: requestContext,
        alertId: 'missing-alert',
        title: 'updated',
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'ALERT_NOT_FOUND',
  );

  await assert.rejects(
    () =>
      removeUseCase.execute({
        context: requestContext,
        alertId: 'missing-alert',
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'ALERT_NOT_FOUND',
  );
});
