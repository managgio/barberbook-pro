import 'reflect-metadata';
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminGuard } from '@/auth/admin.guard';
import { AdminFaqsController, FaqsController } from '@/modules/faqs/faqs.controller';
import { FaqsService } from '@/modules/faqs/faqs.service';
import { CreateFaqDto, FaqVersionDto, ReorderFaqsDto, UpdateFaqDto } from '@/modules/faqs/dto/faq.dto';
import { TenantConfigService } from '@/tenancy/tenant-config.service';

test('every FAQ administrative handler requires LocationStaff for the request tenant', async () => {
  const guard = new AdminGuard(new Reflector(), {
    locationStaff: { findUnique: async ({ where }: any) => where.localId_userId.localId === 'local-a' ? {} : null },
  } as any, { requireUser: async () => ({ id: 'admin-a', role: 'admin', isSuperAdmin: true }) } as any,
  { getRequestContext: () => ({ localId: 'local-b' }) } as any);
  for (const handler of ['list', 'create', 'update', 'remove', 'reorder'] as const) {
    await assert.rejects(() => guard.canActivate({
      getHandler: () => AdminFaqsController.prototype[handler], getClass: () => AdminFaqsController,
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as any), (error: unknown) => error instanceof ForbiddenException);
  }
  assert.equal(await guard.canActivate({ getHandler: () => FaqsController.prototype.list, getClass: () => FaqsController } as any), true);
});

test('FAQ HTTP contracts reject extra tenant authority, missing versions and duplicate order IDs', async () => {
  const options = { whitelist: true, forbidNonWhitelisted: true };
  assert.ok((await validate(plainToInstance(CreateFaqDto, { question: 'q', answer: 'a', localId: 'foreign' }), options)).length);
  assert.ok((await validate(plainToInstance(UpdateFaqDto, { question: 'q', answer: 'a' }), options)).length);
  assert.ok((await validate(plainToInstance(FaqVersionDto, { version: 0 }), options)).length);
  assert.ok((await validate(plainToInstance(ReorderFaqsDto, { expectedIds: ['a'], orderedIds: ['a', 'a'] }), options)).length);
  assert.equal((await validate(plainToInstance(UpdateFaqDto, { question: 'q', answer: 'a', version: 1 }), options)).length, 0);
});

test('FAQ capability is disabled by default and cannot be enabled by a location override', async () => {
  for (const enabled of [undefined, false, true]) {
    const service = new TenantConfigService({
      brandConfig: { findUnique: async () => ({ data: { features: { faqEnabled: enabled } } }) },
      locationConfig: { findUnique: async () => ({ data: { features: { faqEnabled: true } } }) },
    } as any, { getRequestContext: () => ({ brandId: 'brand-a', localId: 'local-a' }) } as any,
    { isReadyForRoutineDelivery: () => false } as any, { isReadyForRoutineDelivery: () => false } as any);
    assert.equal((await service.getPublicConfig()).features.faqEnabled, enabled === true);
    assert.equal((await service.getEffectiveConfig()).features?.faqEnabled, enabled === true);
  }
});

test('admin edits receive source text while public reads use the requested translation', async () => {
  const service = new FaqsService({ list: async () => [{ id: 'a', question: 'Pregunta', answer: 'Respuesta', version: 1, position: 0 }] } as any,
    { getEffectiveConfig: async () => ({ features: { faqEnabled: true } }) } as any,
    { getRequestContext: () => ({ brandId: 'brand-a', localId: 'local-a', requestedLanguage: 'en' }) } as any,
    { localizeCollection: async (params: any) => {
      assert.equal(params.syncMissingSources, false);
      assert.equal(params.context.localId, 'local-a');
      for (const descriptor of params.descriptors) descriptor.setValue(params.items[0], descriptor.fieldKey === 'question' ? 'Question' : 'Answer');
      return { items: params.items };
    } } as any, { get: async () => ({ published: true, version: 0 }) } as any);
  assert.equal((await service.list(true))[0].question, 'Pregunta');
  assert.equal((await service.list())[0].answer, 'Answer');
});
