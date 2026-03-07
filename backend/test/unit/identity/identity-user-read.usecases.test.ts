import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { FindUserByEmailUseCase } from '@/contexts/identity/application/use-cases/find-user-by-email.use-case';
import { FindUserByFirebaseUidUseCase } from '@/contexts/identity/application/use-cases/find-user-by-firebase-uid.use-case';
import { FindUserByIdUseCase } from '@/contexts/identity/application/use-cases/find-user-by-id.use-case';
import { FindUsersByIdsUseCase } from '@/contexts/identity/application/use-cases/find-users-by-ids.use-case';
import { FindUsersPageUseCase } from '@/contexts/identity/application/use-cases/find-users-page.use-case';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: 'user-1',
  timezone: 'Europe/Madrid',
  correlationId: 'corr-identity-users-read-1',
};

test('find users by ids use case keeps tenant scope and ids', async () => {
  const received: { params?: unknown } = {};
  const useCase = new FindUsersByIdsUseCase({
    findUsersByIds: async (params) => {
      received.params = params;
      return [];
    },
    findUsersPage: async () => ({ total: 0, users: [] }),
    findUserById: async () => null,
    findUserByEmail: async () => null,
    findUserByFirebaseUid: async () => null,
  });

  await useCase.execute({
    context: requestContext,
    ids: ['u-1', 'u-2'],
  });

  assert.deepEqual(received.params, {
    brandId: 'brand-1',
    localId: 'local-1',
    ids: ['u-1', 'u-2'],
  });
});

test('find users page use case forwards pagination and filters', async () => {
  const received: { params?: unknown } = {};
  const useCase = new FindUsersPageUseCase({
    findUsersByIds: async () => [],
    findUsersPage: async (params) => {
      received.params = params;
      return { total: 1, users: [] };
    },
    findUserById: async () => null,
    findUserByEmail: async () => null,
    findUserByFirebaseUid: async () => null,
  });

  await useCase.execute({
    context: requestContext,
    page: 3,
    pageSize: 25,
    role: 'admin',
    query: 'ana',
  });

  assert.deepEqual(received.params, {
    brandId: 'brand-1',
    localId: 'local-1',
    page: 3,
    pageSize: 25,
    role: 'admin',
    query: 'ana',
  });
});

test('find user by id use case scopes by brand/local/userId', async () => {
  const received: { params?: unknown } = {};
  const useCase = new FindUserByIdUseCase({
    findUsersByIds: async () => [],
    findUsersPage: async () => ({ total: 0, users: [] }),
    findUserById: async (params) => {
      received.params = params;
      return null;
    },
    findUserByEmail: async () => null,
    findUserByFirebaseUid: async () => null,
  });

  await useCase.execute({
    context: requestContext,
    userId: 'user-42',
  });

  assert.deepEqual(received.params, {
    brandId: 'brand-1',
    localId: 'local-1',
    userId: 'user-42',
  });
});

test('find user by email use case scopes and forwards email', async () => {
  const received: { params?: unknown } = {};
  const useCase = new FindUserByEmailUseCase({
    findUsersByIds: async () => [],
    findUsersPage: async () => ({ total: 0, users: [] }),
    findUserById: async () => null,
    findUserByEmail: async (params) => {
      received.params = params;
      return null;
    },
    findUserByFirebaseUid: async () => null,
  });

  await useCase.execute({
    context: requestContext,
    email: 'test@example.com',
  });

  assert.deepEqual(received.params, {
    brandId: 'brand-1',
    localId: 'local-1',
    email: 'test@example.com',
  });
});

test('find user by firebase uid use case scopes and forwards firebaseUid', async () => {
  const received: { params?: unknown } = {};
  const useCase = new FindUserByFirebaseUidUseCase({
    findUsersByIds: async () => [],
    findUsersPage: async () => ({ total: 0, users: [] }),
    findUserById: async () => null,
    findUserByEmail: async () => null,
    findUserByFirebaseUid: async (params) => {
      received.params = params;
      return null;
    },
  });

  await useCase.execute({
    context: requestContext,
    firebaseUid: 'firebase-123',
  });

  assert.deepEqual(received.params, {
    brandId: 'brand-1',
    localId: 'local-1',
    firebaseUid: 'firebase-123',
  });
});
