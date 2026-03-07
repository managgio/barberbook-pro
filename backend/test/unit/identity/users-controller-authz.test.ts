import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { UsersController } from '@/modules/users/users.controller';

const createController = (overrides?: {
  findByEmail?: (email: string) => Promise<unknown>;
  requireIdentity?: () => Promise<any>;
  resolveUserFromRequest?: () => Promise<any>;
  requireUser?: () => Promise<any>;
  locationStaffFindUnique?: () => Promise<any>;
  localId?: string;
}) => {
  const usersService = {
    findByEmail: overrides?.findByEmail || (async (email: string) => ({ id: 'user-1', email })),
  } as any;

  const authService = {
    requireIdentity:
      overrides?.requireIdentity || (async () => ({ uid: 'user-1', email: 'user@example.com' })),
    resolveUserFromRequest:
      overrides?.resolveUserFromRequest ||
      (async () => ({
        id: 'user-1',
        email: 'user@example.com',
        role: 'client',
        isSuperAdmin: false,
        isPlatformAdmin: false,
      })),
    requireUser:
      overrides?.requireUser ||
      (async () => ({
        id: 'user-1',
        email: 'user@example.com',
        role: 'client',
        isSuperAdmin: false,
        isPlatformAdmin: false,
      })),
  } as any;

  const prisma = {
    locationStaff: {
      findUnique: overrides?.locationStaffFindUnique || (async () => null),
    },
  } as any;

  const tenantContextPort = {
    getRequestContext: () => ({ localId: overrides?.localId || 'local-1' }),
  } as any;

  const controller = new UsersController(usersService, authService, prisma, tenantContextPort);
  return { controller, usersService };
};

test('users controller by-email allows self lookup when token email is missing but actor email matches', async () => {
  const { controller } = createController({
    requireIdentity: async () => ({ uid: 'user-1' }),
    resolveUserFromRequest: async () => ({
      id: 'user-1',
      email: 'user@example.com',
      role: 'client',
      isSuperAdmin: false,
      isPlatformAdmin: false,
    }),
    requireUser: async () => ({
      id: 'user-1',
      email: 'user@example.com',
      role: 'client',
      isSuperAdmin: false,
      isPlatformAdmin: false,
    }),
  });

  const result = await controller.findByEmail({} as any, 'User@Example.com');
  assert.equal((result as any)?.email, 'User@Example.com');
});

test('users controller by-email rejects non-manager when requested email does not match token nor actor', async () => {
  const { controller } = createController({
    requireIdentity: async () => ({ uid: 'user-1' }),
    resolveUserFromRequest: async () => ({
      id: 'user-1',
      email: 'other@example.com',
      role: 'client',
      isSuperAdmin: false,
      isPlatformAdmin: false,
    }),
    requireUser: async () => ({
      id: 'user-1',
      email: 'other@example.com',
      role: 'client',
      isSuperAdmin: false,
      isPlatformAdmin: false,
    }),
  });

  await assert.rejects(
    async () => {
      await controller.findByEmail({} as any, 'target@example.com');
    },
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test('users controller by-email allows manager lookup for another email', async () => {
  const { controller } = createController({
    requireIdentity: async () => ({ uid: 'admin-1' }),
    resolveUserFromRequest: async () => ({
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
      isSuperAdmin: false,
      isPlatformAdmin: false,
    }),
    requireUser: async () => ({
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
      isSuperAdmin: false,
      isPlatformAdmin: false,
    }),
    locationStaffFindUnique: async () => ({ userId: 'admin-1' }),
  });

  const result = await controller.findByEmail({} as any, 'target@example.com');
  assert.equal((result as any)?.email, 'target@example.com');
});
