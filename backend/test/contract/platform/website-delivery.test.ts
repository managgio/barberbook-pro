import 'reflect-metadata';
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { WebsiteAccessGuard } from '@/modules/website/website-access.guard';
import { ImagekitWebsiteMediaAdapter } from '@/modules/website/imagekit-website-media.adapter';
import { DomainError } from '@/shared/domain/domain-error';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReplaceWebsiteImagesDto } from '@/modules/website/website.controller';
import { PrismaPlatformImageKitManagementAdapter } from '@/modules/imagekit/adapters/prisma-platform-imagekit-management.adapter';

test('website guard requires explicit capability, local membership and website permission', async () => {
  const request = {};
  const execution = { switchToHttp: () => ({ getRequest: () => request }) } as any;
  let enabled = false, platform = false;
  let staff: any = { adminRoleId: null };
  const calls: unknown[] = [];
  const guard = new WebsiteAccessGuard({ requireUser: async () => ({ id: 'actor', isPlatformAdmin: platform, role: 'admin', isSuperAdmin: true }) } as any,
    { locationStaff: { findUnique: async (args: unknown) => { calls.push(args); return staff; } } } as any,
    { getEffectiveConfig: async () => ({ adminSidebar: { visibleSections: enabled ? ['website'] : [] } }) } as any,
    { getRequestContext: () => ({ localId: 'local-a' }) } as any);
  await assert.rejects(() => guard.canActivate(execution), ForbiddenException);
  enabled = true; assert.equal(await guard.canActivate(execution), true);
  assert.deepEqual((calls[0] as any).where, { localId_userId: { localId: 'local-a', userId: 'actor' } });
  staff = null; await assert.rejects(() => guard.canActivate(execution), ForbiddenException);
  staff = { adminRoleId: 'role', adminRole: { localId: 'local-a', permissions: ['settings'] } };
  await assert.rejects(() => guard.canActivate(execution), ForbiddenException);
  staff.adminRole.permissions = ['website']; assert.equal(await guard.canActivate(execution), true);
  staff.adminRole.localId = 'local-b'; await assert.rejects(() => guard.canActivate(execution), ForbiddenException);
  platform = true; assert.equal(await guard.canActivate(execution), true);
});
test('website input rejects oversized batches, malformed IDs and missing revisions', async () => {
  const valid = { revision: 'a'.repeat(64), images: [{ fileId: 'image-1' }] };
  assert.equal((await validate(plainToInstance(ReplaceWebsiteImagesDto, valid))).length, 0);
  for (const data of [{ images: [] }, { ...valid, images: [{ fileId: '../other' }] }, { ...valid, images: Array(6).fill({ fileId: 'x' }) }]) {
    assert.ok((await validate(plainToInstance(ReplaceWebsiteImagesDto, data))).length);
  }
});
test('ImageKit website verification rejects foreign locations, providers and unoptimised media', async () => {
  const original = global.fetch;
  let payload: any = { fileId: 'photo', fileType: 'image', filePath: '/root/website/brand/local/photo.webp', url: 'https://images.test/account/website/brand/local/photo.webp', width: 1600, height: 1000, size: 20000 };
  const good = { ...payload };
  global.fetch = async () => new Response(JSON.stringify(payload), { status: 200 });
  try {
    const adapter = new ImagekitWebsiteMediaAdapter({ getBrandConfig: async (brandId: string) => { assert.equal(brandId, 'brand'); return { imagekit: { privateKey: 'test-key', urlEndpoint: 'https://images.test/account' } }; } } as any);
    assert.equal((await adapter.resolve('brand', 'local', 'photo')).fileId, 'photo');
    payload = { ...good, url: `${good.url}?updatedAt=1792353488241` };
    assert.equal((await adapter.resolve('brand', 'local', 'photo')).url, good.url);
    for (const patch of [{ filePath: '/root/website/brand/foreign/photo.webp' }, { filePath: '/root/website/other/local/photo.webp' }, { url: 'https://foreign.test/image.webp' }, { width: 9000 }, { size: 5_000_000 }, { fileType: 'non-image' }]) {
      payload = { ...good, ...patch };
      await assert.rejects(() => adapter.resolve('brand', 'local', 'photo'), (error: unknown) => error instanceof DomainError && error.code === 'WEBSITE_INVALID_MEDIA');
    }
  } finally { global.fetch = original; }
});

test('generic media deletion cannot bypass website lifecycle or delete another brand or a referenced image', async () => {
  const original = global.fetch;
  let path = '/root/brand/website/brand/local/photo.webp';
  let referenced = true;
  let deletions = 0;
  global.fetch = async (_url, options) => {
    if (options?.method === 'DELETE') { deletions++; return new Response('', { status: 204 }); }
    return new Response(JSON.stringify({ filePath: path, url: 'https://images.test/photo.webp' }), { status: 200 });
  };
  try {
    const adapter = new PrismaPlatformImageKitManagementAdapter({ getEffectiveConfig: async () => ({ imagekit: { privateKey: 'test', publicKey: 'public', urlEndpoint: 'https://images.test', folder: '/root/brand' } }) } as any,
      { $queryRaw: async () => [{ found: referenced ? 1 : 0 }] } as any, { getRequestContext: () => ({ brandId: 'brand', localId: 'local', subdomain: 'brand' }) } as any);
    await assert.rejects(() => adapter.deleteFile('image'), /MEDIA_MANAGED_BY_WEBSITE/);
    path = '/root/other/photo.webp'; await assert.rejects(() => adapter.deleteFile('image'), /MEDIA_ACCESS_DENIED/);
    path = '/root/brand/landing/photo.webp'; await assert.rejects(() => adapter.deleteFile('image'), /MEDIA_IN_USE/);
    assert.equal(deletions, 0);
    referenced = false;
    global.fetch = async (_url, options) => options?.method === 'DELETE' ? (deletions++, new Response(null, { status: 204 })) : new Response(JSON.stringify({ filePath: path, url: 'https://images.test/photo.webp' }));
    await adapter.deleteFile('image'); assert.equal(deletions, 1);
  } finally { global.fetch = original; }
});
