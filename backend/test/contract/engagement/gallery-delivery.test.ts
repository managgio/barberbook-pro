import 'reflect-metadata';
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminGuard } from '@/auth/admin.guard';
import { AdminGalleryController, GalleryController } from '@/modules/gallery/gallery.controller';
import { LandingPublicationController, UpdateLandingPublicationDto } from '@/modules/landing-publication/landing-publication.controller';
import { GalleryItemDto, GalleryOrderDto, UpdateGalleryItemDto } from '@/modules/gallery/dto/gallery.dto';
import { TenantConfigService } from '@/tenancy/tenant-config.service';
import { GalleryService } from '@/modules/gallery/gallery.service';
import { DomainError } from '@/shared/domain/domain-error';

test('gallery and publication administrative handlers require staff in the request location', async () => {
  const guard = new AdminGuard(new Reflector(), { locationStaff: { findUnique: async () => null } } as any,
    { requireUser: async () => ({ id: 'foreign-admin', role: 'admin', isSuperAdmin: true }) } as any,
    { getRequestContext: () => ({ localId: 'other' }) } as any);
  for (const Controller of [AdminGalleryController, LandingPublicationController]) {
    for (const name of Object.getOwnPropertyNames(Controller.prototype).filter((key) => key !== 'constructor' && key !== 'execute')) {
      await assert.rejects(() => guard.canActivate({ getHandler: () => (Controller.prototype as any)[name], getClass: () => Controller,
        switchToHttp: () => ({ getRequest: () => ({}) }) } as any), (error: unknown) => error instanceof ForbiddenException);
    }
  }
  assert.equal(await guard.canActivate({ getHandler: () => GalleryController.prototype.list, getClass: () => GalleryController } as any), true);
});

test('gallery DTOs reject tenant injection, unverified URLs, missing versions and malformed orders', async () => {
  const options = { whitelist: true, forbidNonWhitelisted: true };
  const valid = { title: 'Title', description: '', categoryId: 'cat', imageFileId: 'image', beforeFileId: null };
  assert.equal((await validate(plainToInstance(GalleryItemDto, valid), options)).length, 0);
  for (const extra of [{ localId: 'other' }, { brandId: 'other' }, { imageUrl: 'https://external.test/file.jpg' }]) {
    assert.ok((await validate(plainToInstance(GalleryItemDto, { ...valid, ...extra }), options)).length);
  }
  assert.ok((await validate(plainToInstance(UpdateGalleryItemDto, valid), options)).length);
  assert.ok((await validate(plainToInstance(GalleryOrderDto, { expectedIds: ['a'], orderedIds: ['a', 'a'] }), options)).length);
  for (const publication of [{ published: 'true', version: 0 }, { published: true, version: -1 }, { published: true, version: 0, localId: 'other' }]) {
    assert.ok((await validate(plainToInstance(UpdateLandingPublicationDto, publication), options)).length);
  }
});

test('gallery starts disabled and a location override cannot enable it', async () => {
  for (const enabled of [undefined, false, true]) {
    const service = new TenantConfigService({ brandConfig: { findUnique: async () => ({ data: { features: { galleryEnabled: enabled } } }) },
      locationConfig: { findUnique: async () => ({ data: { features: { galleryEnabled: true } } }) } } as any,
    { getRequestContext: () => ({ brandId: 'a', localId: 'a-local' }) } as any,
    { isReadyForRoutineDelivery: () => false } as any, { isReadyForRoutineDelivery: () => false } as any);
    assert.equal((await service.getPublicConfig()).features.galleryEnabled, enabled === true);
    assert.equal((await service.getEffectiveConfig()).features?.galleryEnabled, enabled === true);
  }
});

test('public gallery reads translate categories and work text without mutating source content', async () => {
  const collection = () => ({ items: [{ id: 'work', title: 'Título', description: 'Descripción' }], categories: [{ id: 'category', name: 'Categoría' }] });
  const calls: string[] = [];
  const service = new GalleryService({ list: async () => collection(), imageUsage: async () => ({ used: 1, limit: 12 }) } as any,
    { getEffectiveConfig: async () => ({ features: { galleryEnabled: true } }) } as any,
    { get: async () => ({ published: true }) } as any, {} as any,
    { getRequestContext: () => ({ brandId: 'a', localId: 'local-a' }) } as any,
    { localizeCollection: async (params: any) => {
      assert.equal(params.syncMissingSources, false); calls.push(params.entityType);
      for (const descriptor of params.descriptors) descriptor.setValue(params.items[0], `Translated ${descriptor.fieldKey}`);
      return { items: params.items };
    } } as any);
  assert.equal((await service.list(true)).items[0].title, 'Título');
  const translated = await service.list();
  assert.equal(translated.items[0].title, 'Translated title');
  assert.equal(translated.categories[0].name, 'Translated name');
  assert.deepEqual(calls.sort(), ['gallery_category', 'gallery_item']);
});

test('gallery capacity violations return a stable client error instead of a server failure', async () => {
  const service = new GalleryService({ saveItem: async () => { throw new DomainError('Limit', 'GALLERY_IMAGE_LIMIT'); } } as any,
    { getEffectiveConfig: async () => ({ features: { galleryEnabled: true } }) } as any, {} as any,
    { resolve: async (_context: unknown, fileId: string) => ({ fileId, url: 'https://images.test/work.webp', width: 800, height: 1000 }) },
    { getRequestContext: () => ({ brandId: 'a', localId: 'local-a' }) } as any, {} as any);
  await assert.rejects(() => service.saveItem(null, { title: 'Work', description: '', categoryId: 'cat', imageFileId: 'image', beforeFileId: null }),
    (error: unknown) => error instanceof BadRequestException && error.message === 'GALLERY_IMAGE_LIMIT');
});
