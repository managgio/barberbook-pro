import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '@/auth/auth.service';
import { AdminGuard } from '@/auth/admin.guard';
import { AiAssistantGuard } from '@/modules/ai-assistant/ai-assistant.guard';
import { PlatformAdminGuard } from '@/modules/platform-admin/platform-admin.guard';

const createExecutionContext = (request: Record<string, unknown> = {}) =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as any;

test('auth service resolves user from bearer token', async () => {
  const calls: string[] = [];
  const prisma = {
    user: {
      findUnique: async ({ where }: { where: { firebaseUid: string } }) => {
        calls.push(where.firebaseUid);
        return { id: 'user-1', firebaseUid: where.firebaseUid };
      },
    },
  } as any;
  const firebaseAdmin = {
    verifyIdToken: async (token: string) => ({ uid: token.replace('token-', '') }),
  } as any;
  const service = new AuthService(prisma, firebaseAdmin);

  const user = await service.resolveUserFromRequest({
    headers: { authorization: 'Bearer token-fb-1' },
  });

  assert.equal(user?.id, 'user-1');
  assert.deepEqual(calls, ['fb-1']);
});

test('auth service requireIdentity rejects missing token', async () => {
  const service = new AuthService({ user: { findUnique: async () => null } } as any, {
    verifyIdToken: async () => null,
  } as any);

  await assert.rejects(
    async () => {
      await service.requireIdentity({ headers: {} });
    },
    (error: unknown) => error instanceof UnauthorizedException,
  );
});

test('auth service requireUser rejects when firebase token is invalid', async () => {
  const service = new AuthService(
    { user: { findUnique: async () => null } } as any,
    { verifyIdToken: async () => null } as any,
  );

  await assert.rejects(
    async () => {
      await service.requireUser({ headers: { authorization: 'Bearer invalid' } });
    },
    (error: unknown) => error instanceof UnauthorizedException,
  );
});

test('admin guard allows non-admin endpoint without auth lookup', async () => {
  const guard = new AdminGuard(
    { getAllAndOverride: () => false } as any,
    { locationStaff: { findUnique: async () => null } } as any,
    {
      requireUser: async () => {
        throw new Error('should-not-be-called');
      },
    } as any,
    { getRequestContext: () => ({ localId: 'local-1' }) } as any,
  );

  const request: Record<string, unknown> = {};
  const allowed = await guard.canActivate(createExecutionContext(request));
  assert.equal(allowed, true);
  assert.equal(request.adminUserId, undefined);
});

test('admin guard allows super admin in admin endpoint', async () => {
  const guard = new AdminGuard(
    { getAllAndOverride: () => true } as any,
    { locationStaff: { findUnique: async () => null } } as any,
    {
      requireUser: async () => ({
        id: 'admin-1',
        role: 'admin',
        isSuperAdmin: true,
        isPlatformAdmin: false,
      }),
    } as any,
    { getRequestContext: () => ({ localId: 'local-1' }) } as any,
  );

  const request: Record<string, unknown> = {};
  const allowed = await guard.canActivate(createExecutionContext(request));
  assert.equal(allowed, true);
  assert.equal(request.adminUserId, 'admin-1');
});

test('admin guard blocks admin user outside location staff scope', async () => {
  const guard = new AdminGuard(
    { getAllAndOverride: () => true } as any,
    { locationStaff: { findUnique: async () => null } } as any,
    {
      requireUser: async () => ({
        id: 'admin-2',
        role: 'admin',
        isSuperAdmin: false,
        isPlatformAdmin: false,
      }),
    } as any,
    { getRequestContext: () => ({ localId: 'local-1' }) } as any,
  );

  await assert.rejects(
    async () => {
      await guard.canActivate(createExecutionContext({}));
    },
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test('ai assistant guard allows local admin with staff membership', async () => {
  const guard = new AiAssistantGuard(
    {
      hasLocationStaffMembership: async () => true,
    } as any,
    {
      requireUser: async () => ({
        id: 'admin-3',
        role: 'admin',
        isSuperAdmin: false,
        isPlatformAdmin: false,
      }),
    } as any,
    { getRequestContext: () => ({ localId: 'local-1' }) } as any,
  );

  const request: Record<string, unknown> = {};
  const allowed = await guard.canActivate(createExecutionContext(request));
  assert.equal(allowed, true);
  assert.equal(request.adminUserId, 'admin-3');
});

test('ai assistant guard blocks non-admin users', async () => {
  const guard = new AiAssistantGuard(
    {
      hasLocationStaffMembership: async () => false,
    } as any,
    {
      requireUser: async () => ({
        id: 'client-1',
        role: 'client',
        isSuperAdmin: false,
        isPlatformAdmin: false,
      }),
    } as any,
    { getRequestContext: () => ({ localId: 'local-1' }) } as any,
  );

  await assert.rejects(
    async () => {
      await guard.canActivate(createExecutionContext({}));
    },
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test('platform admin guard enforces platform access and stores platformUserId', async () => {
  const guard = new PlatformAdminGuard({
    requireUser: async () => ({
      id: 'platform-1',
      isPlatformAdmin: true,
    }),
  } as any);

  const request: Record<string, unknown> = {};
  const allowed = await guard.canActivate(createExecutionContext(request));
  assert.equal(allowed, true);
  assert.equal(request.platformUserId, 'platform-1');
});

test('platform admin guard blocks non platform admins', async () => {
  const guard = new PlatformAdminGuard({
    requireUser: async () => ({
      id: 'admin-regular',
      isPlatformAdmin: false,
    }),
  } as any);

  await assert.rejects(
    async () => {
      await guard.canActivate(createExecutionContext({}));
    },
    (error: unknown) => error instanceof ForbiddenException,
  );
});
