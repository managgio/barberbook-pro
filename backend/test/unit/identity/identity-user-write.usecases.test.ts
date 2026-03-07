import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { CreateUserUseCase } from '@/contexts/identity/application/use-cases/create-user.use-case';
import { RemoveUserUseCase } from '@/contexts/identity/application/use-cases/remove-user.use-case';
import { SetUserBrandBlockStatusUseCase } from '@/contexts/identity/application/use-cases/set-user-brand-block-status.use-case';
import { UpdateUserUseCase } from '@/contexts/identity/application/use-cases/update-user.use-case';
import { DomainError } from '@/shared/domain/domain-error';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: 'admin-1',
  timezone: 'Europe/Madrid',
  correlationId: 'corr-identity-users-write-1',
};

const sampleUser = {
  id: 'user-1',
  firebaseUid: 'firebase-1',
  name: 'Ana',
  email: 'ana@example.com',
  phone: null,
  role: 'client' as const,
  avatar: null,
  adminRoleId: null,
  isSuperAdmin: false,
  isPlatformAdmin: false,
  notificationEmail: true,
  notificationWhatsapp: true,
  notificationSms: true,
  prefersBarberSelection: true,
  isBlocked: false,
  isLocalAdmin: false,
  localAdminRoleId: null,
};

test('create user use case passes scoped payload to write port', async () => {
  const received: { params?: unknown } = {};
  const useCase = new CreateUserUseCase({
    create: async (params) => {
      received.params = params;
      return sampleUser;
    },
    update: async () => null,
    setBrandBlockStatus: async () => null,
    remove: async () => null,
  });

  await useCase.execute({
    context: requestContext,
    firebaseUid: 'firebase-1',
    name: 'Ana',
    email: 'ana@example.com',
    role: 'client',
  });

  assert.deepEqual(received.params, {
    brandId: 'brand-1',
    localId: 'local-1',
    input: {
      firebaseUid: 'firebase-1',
      name: 'Ana',
      email: 'ana@example.com',
      phone: undefined,
      role: 'client',
      avatar: undefined,
      adminRoleId: undefined,
      isSuperAdmin: undefined,
      isPlatformAdmin: undefined,
      notificationEmail: undefined,
      notificationWhatsapp: undefined,
      notificationSms: undefined,
      prefersBarberSelection: undefined,
    },
  });
});

test('update user use case throws USER_NOT_FOUND when write port returns null', async () => {
  const useCase = new UpdateUserUseCase({
    create: async () => sampleUser,
    update: async () => null,
    setBrandBlockStatus: async () => null,
    remove: async () => null,
  });

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        userId: 'missing',
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'USER_NOT_FOUND',
  );
});

test('set user brand block status use case throws USER_NOT_FOUND when membership is missing', async () => {
  const useCase = new SetUserBrandBlockStatusUseCase({
    create: async () => sampleUser,
    update: async () => sampleUser,
    setBrandBlockStatus: async () => null,
    remove: async () => null,
  });

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        userId: 'missing',
        isBlocked: true,
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'USER_NOT_FOUND',
  );
});

test('remove user use case deletes auth user when removed globally', async () => {
  const calls: string[] = [];
  const useCase = new RemoveUserUseCase(
    {
      create: async () => sampleUser,
      update: async () => sampleUser,
      setBrandBlockStatus: async () => sampleUser,
      remove: async () => ({ removedGlobally: true, firebaseUid: 'firebase-1' }),
    },
    {
      deleteUser: async (firebaseUid) => {
        calls.push(firebaseUid);
      },
    },
  );

  const result = await useCase.execute({
    context: requestContext,
    userId: 'user-1',
  });

  assert.deepEqual(result, { success: true, removedGlobally: true });
  assert.deepEqual(calls, ['firebase-1']);
});

test('remove user use case swallows auth delete errors', async () => {
  const useCase = new RemoveUserUseCase(
    {
      create: async () => sampleUser,
      update: async () => sampleUser,
      setBrandBlockStatus: async () => sampleUser,
      remove: async () => ({ removedGlobally: true, firebaseUid: 'firebase-1' }),
    },
    {
      deleteUser: async () => {
        throw new Error('firebase-down');
      },
    },
  );

  const result = await useCase.execute({
    context: requestContext,
    userId: 'user-1',
  });

  assert.deepEqual(result, { success: true, removedGlobally: true });
});
