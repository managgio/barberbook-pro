import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommunicationsGuard } from '@/modules/communications/communications.guard';

const createExecutionContext = (request: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as any;

const buildGuard = (options?: {
  requiredPermission?: string;
  featureEnabled?: boolean;
  user?: {
    id: string;
    role: string;
    isSuperAdmin?: boolean;
    isPlatformAdmin?: boolean;
  };
  hasStaffMembership?: boolean;
  rolePermissions?: string[];
}) => {
  const reflector = {
    getAllAndOverride: () => options?.requiredPermission || null,
  };
  const authService = {
    requireUser: async () =>
      options?.user || {
        id: 'admin-1',
        role: 'admin',
        isSuperAdmin: false,
        isPlatformAdmin: false,
      },
  };
  const prisma = {
    locationStaff: {
      findUnique: async () =>
        options?.hasStaffMembership === false
          ? null
          : {
              adminRoleId: 'role-1',
            },
    },
    adminRole: {
      findFirst: async () => ({
        permissions: options?.rolePermissions || [],
      }),
    },
  };
  const tenantConfigService = {
    getEffectiveConfig: async () => ({
      features: {
        communicationsEnabled: options?.featureEnabled !== false,
      },
    }),
  };
  const tenantContextPort = {
    getRequestContext: () => ({
      localId: 'local-1',
    }),
  };

  return new CommunicationsGuard(
    reflector as any,
    authService as any,
    prisma as any,
    tenantConfigService as any,
    tenantContextPort as any,
  );
};

test('communications guard blocks endpoint when feature is disabled for tenant', async () => {
  const guard = buildGuard({
    requiredPermission: 'communications:view',
    featureEnabled: false,
  });

  await assert.rejects(
    async () => {
      await guard.canActivate(
        createExecutionContext({
          method: 'GET',
          originalUrl: '/api/admin/communications',
        }),
      );
    },
    (error: unknown) => error instanceof NotFoundException,
  );
});

test('communications guard requires execute permission for immediate create', async () => {
  const guard = buildGuard({
    requiredPermission: 'communications:create_draft',
    rolePermissions: ['communications:create_draft'],
  });

  await assert.rejects(
    async () => {
      await guard.canActivate(
        createExecutionContext({
          method: 'POST',
          originalUrl: '/api/admin/communications',
          body: {
            actionType: 'solo_comunicar',
            executeNow: true,
          },
        }),
      );
    },
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test('communications guard requires schedule permission for scheduled create', async () => {
  const guard = buildGuard({
    requiredPermission: 'communications:create_draft',
    rolePermissions: ['communications:create_draft'],
  });

  await assert.rejects(
    async () => {
      await guard.canActivate(
        createExecutionContext({
          method: 'POST',
          originalUrl: '/api/admin/communications',
          body: {
            actionType: 'solo_comunicar',
            scheduleAt: '2026-04-11T10:00:00.000Z',
          },
        }),
      );
    },
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test('communications guard allows scheduled create when required granular permissions are present', async () => {
  const guard = buildGuard({
    requiredPermission: 'communications:create_draft',
    rolePermissions: ['communications:create_draft', 'communications:schedule'],
  });

  const allowed = await guard.canActivate(
    createExecutionContext({
      method: 'POST',
      originalUrl: '/api/admin/communications',
      body: {
        actionType: 'solo_comunicar',
        scheduleAt: '2026-04-11T10:00:00.000Z',
      },
    }),
  );

  assert.equal(allowed, true);
});

test('communications guard allows super admin regardless of local role permissions', async () => {
  const guard = buildGuard({
    requiredPermission: 'communications:execute',
    rolePermissions: [],
    user: {
      id: 'super-1',
      role: 'admin',
      isSuperAdmin: true,
      isPlatformAdmin: false,
    },
  });

  const request: Record<string, unknown> = {
    method: 'POST',
    originalUrl: '/api/admin/communications/campaign-1/execute',
  };
  const allowed = await guard.canActivate(createExecutionContext(request));
  assert.equal(allowed, true);
  assert.equal(request.adminUserId, 'super-1');
});
