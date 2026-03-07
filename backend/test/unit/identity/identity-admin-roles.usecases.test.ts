import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { CreateAdminRoleUseCase } from '@/contexts/identity/application/use-cases/create-admin-role.use-case';
import { GetAdminRolesUseCase } from '@/contexts/identity/application/use-cases/get-admin-roles.use-case';
import { RemoveAdminRoleUseCase } from '@/contexts/identity/application/use-cases/remove-admin-role.use-case';
import { UpdateAdminRoleUseCase } from '@/contexts/identity/application/use-cases/update-admin-role.use-case';
import { DomainError } from '@/shared/domain/domain-error';

const requestContext = {
  tenantId: 'tenant-1',
  brandId: 'brand-1',
  localId: 'local-1',
  actorUserId: 'user-1',
  timezone: 'Europe/Madrid',
  correlationId: 'corr-identity-roles-1',
};

test('get admin roles use case filters by localId from request context', async () => {
  const calls: string[] = [];
  const useCase = new GetAdminRolesUseCase({
    listByLocalId: async (localId) => {
      calls.push(localId);
      return [];
    },
    create: async () => {
      throw new Error('not used');
    },
    findByIdAndLocalId: async () => null,
    updateById: async () => {
      throw new Error('not used');
    },
    deleteById: async () => undefined,
    clearRoleAssignments: async () => undefined,
  });

  await useCase.execute({ context: requestContext });

  assert.deepEqual(calls, ['local-1']);
});

test('create admin role use case passes payload to repository', async () => {
  const received: { input?: unknown } = {};
  const useCase = new CreateAdminRoleUseCase({
    listByLocalId: async () => [],
    create: async (input) => {
      received.input = input;
      return {
        id: 'role-1',
        localId: 'local-1',
        name: 'Manager',
        description: 'desc',
        permissions: ['appointments.read'],
      };
    },
    findByIdAndLocalId: async () => null,
    updateById: async () => {
      throw new Error('not used');
    },
    deleteById: async () => undefined,
    clearRoleAssignments: async () => undefined,
  });

  const result = await useCase.execute({
    context: requestContext,
    name: 'Manager',
    description: 'desc',
    permissions: ['appointments.read'],
  });

  assert.deepEqual(received.input, {
    localId: 'local-1',
    name: 'Manager',
    description: 'desc',
    permissions: ['appointments.read'],
  });
  assert.equal(result.id, 'role-1');
});

test('update admin role use case throws ROLE_NOT_FOUND when role is outside tenant scope', async () => {
  const useCase = new UpdateAdminRoleUseCase({
    listByLocalId: async () => [],
    create: async () => {
      throw new Error('not used');
    },
    findByIdAndLocalId: async () => null,
    updateById: async () => {
      throw new Error('not used');
    },
    deleteById: async () => undefined,
    clearRoleAssignments: async () => undefined,
  });

  await assert.rejects(
    () =>
      useCase.execute({
        context: requestContext,
        roleId: 'missing-role',
        name: 'New role name',
      }),
    (error: unknown) => error instanceof DomainError && error.code === 'ROLE_NOT_FOUND',
  );
});

test('remove admin role use case deletes role and clears user assignments', async () => {
  const calls: string[] = [];
  const useCase = new RemoveAdminRoleUseCase({
    listByLocalId: async () => [],
    create: async () => {
      throw new Error('not used');
    },
    findByIdAndLocalId: async () => ({
      id: 'role-1',
      localId: 'local-1',
      name: 'Manager',
      description: null,
      permissions: [],
    }),
    updateById: async () => {
      throw new Error('not used');
    },
    deleteById: async (id) => {
      calls.push(`delete:${id}`);
    },
    clearRoleAssignments: async (id) => {
      calls.push(`clear:${id}`);
    },
  });

  await useCase.execute({
    context: requestContext,
    roleId: 'role-1',
  });

  assert.deepEqual(calls, ['delete:role-1', 'clear:role-1']);
});

