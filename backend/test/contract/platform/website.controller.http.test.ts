import 'reflect-metadata';
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WebsiteController } from '@/modules/website/website.controller';
import { WebsiteAccessGuard } from '@/modules/website/website-access.guard';
import { AuthService } from '@/auth/auth.service';
import { AdminGuard } from '@/auth/admin.guard';
import { PrismaService } from '@/prisma/prisma.service';
import { TenantConfigService } from '@/tenancy/tenant-config.service';
import { TENANT_CONTEXT_PORT } from '@/contexts/platform/ports/outbound/tenant-context.port';
import { WEBSITE_MEDIA_PORT } from '@/contexts/platform/ports/outbound/website-media.port';
import { DomainError } from '@/shared/domain/domain-error';

test('website HTTP enforces authentication, local permissions, capability and validated scoped updates', async () => {
  let enabled = true, staff: any = { adminRoleId: null };
  const context = { brandId: 'brand-a', localId: 'local-a', actorUserId: 'user-a' };
  const revision = 'a'.repeat(64);
  const snapshot = { revision, sections: [{ key: 'hero', kind: 'hero', limit: 5, images: [] }] };
  let saves = 0;
  const auth = { requireUser: async (req: any) => {
    if (req.headers.authorization !== 'Bearer session') throw new UnauthorizedException();
    return { id: 'user-a', isSuperAdmin: true, role: 'admin' };
  } };
  const prisma = { locationStaff: { findUnique: async (args: any) => { assert.deepEqual(args.where, { localId_userId: { localId: 'local-a', userId: 'user-a' } }); return staff; } } };
  const tenant = { getRequestContext: () => context };
  const media = {
    read: async (scope: unknown) => { assert.equal(scope, context); return snapshot; },
    resolve: async (scope: unknown, fileId: string) => { assert.equal(scope, context); if (fileId === 'foreign') throw new DomainError('Invalid media.', 'WEBSITE_INVALID_MEDIA'); return { fileId, url: 'https://images.test/new.webp' }; },
    save: async (scope: unknown, version: string, section: string, images: unknown[]) => { assert.equal(scope, context); assert.equal(version, revision); assert.equal(section, 'hero'); saves++; return { ...snapshot, sections: [{ ...snapshot.sections[0], images }] }; },
    discard: async () => {},
  };
  const module = await Test.createTestingModule({ controllers: [WebsiteController], providers: [WebsiteAccessGuard,
    { provide: AuthService, useValue: auth }, { provide: PrismaService, useValue: prisma },
    { provide: TenantConfigService, useValue: { getEffectiveConfig: async () => ({ adminSidebar: { visibleSections: enabled ? ['website'] : [] } }) } },
    { provide: TENANT_CONTEXT_PORT, useValue: tenant }, { provide: WEBSITE_MEDIA_PORT, useValue: media },
  ] }).compile();
  const app = module.createNestApplication({ logger: false });
  app.useGlobalGuards(new AdminGuard(new Reflector(), prisma as any, auth as any, tenant as any));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  try {
    const base = await app.getUrl() + '/admin/website/images';
    const headers = { authorization: 'Bearer session', 'content-type': 'application/json' };
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(base, { headers })).status, 200);
    staff = null; assert.equal((await fetch(base, { headers })).status, 403);
    staff = { adminRoleId: 'role-a', adminRole: { localId: 'local-a', permissions: ['settings'] } };
    assert.equal((await fetch(base, { headers })).status, 403);
    staff.adminRole.permissions = ['website'];
    enabled = false; assert.equal((await fetch(base, { headers })).status, 403);
    enabled = true;
    const put = (body: unknown) => fetch(base + '/hero', { method: 'PUT', headers, body: JSON.stringify(body) });
    assert.equal((await put({ revision, images: [], localId: 'foreign' })).status, 400);
    assert.equal((await put({ revision: 'old', images: [] })).status, 400);
    assert.equal((await put({ revision, images: [{ fileId: 'foreign' }] })).status, 400);
    const updated = await put({ revision, images: [{ fileId: 'new-photo' }] });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).sections[0].images[0].fileId, 'new-photo');
    assert.equal(saves, 1);
  } finally { await app.close(); }
});
