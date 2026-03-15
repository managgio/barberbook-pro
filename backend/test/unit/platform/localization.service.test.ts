import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { LocalizationService } from '@/modules/localization/localization.service';
import { LocalizedTranslationStatus } from '@prisma/client';

const buildContext = (requestedLanguage?: string) => ({
  tenantId: 'brand-1',
  brandId: 'brand-1',
  localId: 'local-1',
  requestedLanguage: requestedLanguage || null,
  actorUserId: null,
  timezone: 'Europe/Madrid',
  correlationId: 'corr-1',
  subdomain: 'demo',
});

test('upsertManualTranslation rejects languages not enabled for tenant', async () => {
  const prisma = {
    localizedContent: {
      findFirst: async () => ({ id: 'content-1', sourceLanguage: 'es', sourceVersion: 2 }),
    },
    localizedContentTranslation: {
      upsert: async () => ({ id: 'tr-1' }),
    },
  } as any;

  const tenantConfig = {
    getBrandConfig: async () => ({ i18n: { defaultLanguage: 'es', supportedLanguages: ['es', 'en'] } }),
    getLocationConfig: async () => ({}),
  } as any;

  const tenantContext = {
    getRequestContext: () => buildContext('fr'),
  } as any;

  const translationProvider = { translateText: async () => ({ translatedText: 'noop' }) } as any;

  const service = new LocalizationService(prisma, tenantConfig, tenantContext, translationProvider);

  await assert.rejects(
    service.upsertManualTranslation({
      entityType: 'service',
      entityId: 'svc-1',
      fieldKey: 'name',
      language: 'fr',
      translatedText: 'Coupe',
    }),
    (error) => error instanceof BadRequestException,
  );
});

test('localizeCollection applies ready translation for requested language', async () => {
  let findManyCall = 0;

  const prisma = {
    localizedContent: {
      findMany: async () => {
        findManyCall += 1;
        if (findManyCall === 1) {
          return [
            {
              id: 'content-1',
              entityId: 'svc-1',
              fieldKey: 'name',
              sourceLanguage: 'es',
              sourceVersion: 1,
              brandId: 'brand-1',
              localId: 'local-1',
            },
          ];
        }
        return [
          {
            id: 'content-1',
            entityId: 'svc-1',
            fieldKey: 'name',
            sourceLanguage: 'es',
            sourceVersion: 1,
            translations: [
              {
                language: 'en',
                status: LocalizedTranslationStatus.ready,
                basedOnSourceVersion: 1,
                translatedText: 'Haircut',
              },
            ],
          },
        ];
      },
      create: async () => {
        throw new Error('create should not be called when source exists');
      },
    },
    localizedContentTranslation: {
      findMany: async () => [],
      createMany: async () => ({ count: 0 }),
    },
  } as any;

  const tenantConfig = {
    getBrandConfig: async () => ({ i18n: { defaultLanguage: 'es', supportedLanguages: ['es', 'en'] } }),
    getLocationConfig: async () => ({}),
  } as any;

  const tenantContext = {
    getRequestContext: () => buildContext('en'),
  } as any;

  const translationProvider = { translateText: async () => ({ translatedText: 'noop' }) } as any;

  const service = new LocalizationService(prisma, tenantConfig, tenantContext, translationProvider);

  const item = { id: 'svc-1', name: 'Corte' };
  const result = await service.localizeCollection({
    entityType: 'service',
    items: [item],
    descriptors: [
      {
        fieldKey: 'name',
        getValue: (entry) => entry.name,
        setValue: (entry, value) => {
          entry.name = value;
        },
      },
    ],
  });

  assert.equal(result.language, 'en');
  assert.equal(result.items[0].name, 'Haircut');
});

test('localizeCollection falls back to default language when request is unsupported', async () => {
  const prisma = {
    localizedContent: {
      findMany: async () => [],
      create: async () => ({ id: 'content-1', brandId: 'brand-1', localId: 'local-1', sourceLanguage: 'es', sourceVersion: 1 }),
    },
    localizedContentTranslation: {
      findMany: async () => [],
      createMany: async () => ({ count: 0 }),
    },
  } as any;

  const tenantConfig = {
    getBrandConfig: async () => ({ i18n: { defaultLanguage: 'es', supportedLanguages: ['es', 'en'] } }),
    getLocationConfig: async () => ({}),
  } as any;

  const tenantContext = {
    getRequestContext: () => buildContext('fr'),
  } as any;

  const translationProvider = { translateText: async () => ({ translatedText: 'noop' }) } as any;

  const service = new LocalizationService(prisma, tenantConfig, tenantContext, translationProvider);

  const item = { id: 'svc-1', name: 'Corte' };
  const result = await service.localizeCollection({
    entityType: 'service',
    items: [item],
    descriptors: [
      {
        fieldKey: 'name',
        getValue: (entry) => entry.name,
        setValue: (entry, value) => {
          entry.name = value;
        },
      },
    ],
  });

  assert.equal(result.language, 'es');
  assert.equal(result.items[0].name, 'Corte');
});

test('getEntityTranslationSummaries returns aggregate status per entity', async () => {
  const prisma = {
    localizedContent: {
      findMany: async () => [
        {
          entityId: 'svc-1',
          sourceLanguage: 'en',
          sourceVersion: 2,
          translations: [
            {
              language: 'es',
              status: LocalizedTranslationStatus.ready,
              basedOnSourceVersion: 2,
              translatedText: 'Corte',
            },
          ],
        },
        {
          entityId: 'svc-3',
          sourceLanguage: 'en',
          sourceVersion: 1,
          translations: [
            {
              language: 'es',
              status: LocalizedTranslationStatus.pending,
              basedOnSourceVersion: 1,
              translatedText: '',
            },
          ],
        },
      ],
    },
  } as any;

  const tenantConfig = {
    getBrandConfig: async () => ({ i18n: { defaultLanguage: 'en', supportedLanguages: ['en', 'es'] } }),
    getLocationConfig: async () => ({}),
  } as any;

  const tenantContext = {
    getRequestContext: () => buildContext('en'),
  } as any;

  const translationProvider = { translateText: async () => ({ translatedText: 'noop' }) } as any;
  const service = new LocalizationService(prisma, tenantConfig, tenantContext, translationProvider);

  const summaries = await service.getEntityTranslationSummaries({
    entityType: 'service',
    entityIds: ['svc-1', 'svc-2', 'svc-3'],
  });

  assert.equal(summaries.length, 3);
  const svc1 = summaries.find((entry) => entry.entityId === 'svc-1');
  const svc2 = summaries.find((entry) => entry.entityId === 'svc-2');
  const svc3 = summaries.find((entry) => entry.entityId === 'svc-3');

  assert.equal(svc1?.status, 'ready');
  assert.equal(svc2?.status, 'missing');
  assert.equal(svc3?.status, 'pending');
});

test('getEntityTranslations realigns legacy source language to tenant default', async () => {
  let findManyCall = 0;
  let updatedSourceLanguage: string | null = null;
  let updatedSourceVersion: number | null = null;

  const prisma = {
    localizedContent: {
      findMany: async (args: any) => {
        findManyCall += 1;
        if (findManyCall === 1) {
          assert.equal(args.where?.sourceLanguage?.not, 'es');
          return [
            {
              id: 'content-1',
              brandId: 'brand-1',
              localId: 'local-1',
              sourceVersion: 2,
            },
          ];
        }
        return [
          {
            fieldKey: 'name',
            sourceLanguage: 'es',
            sourceText: 'Afeitado clásico',
            sourceVersion: 3,
            translations: [
              {
                language: 'en',
                translatedText: 'Classic shave',
                status: LocalizedTranslationStatus.ready,
                source: 'ai',
                manualLocked: false,
                basedOnSourceVersion: 3,
                errorMessage: null,
                updatedAt: new Date().toISOString(),
              },
            ],
          },
        ];
      },
      update: async ({ data }: any) => {
        updatedSourceLanguage = data.sourceLanguage;
        updatedSourceVersion = data.sourceVersion;
        return { id: 'content-1' };
      },
    },
    localizedContentTranslation: {
      updateMany: async () => ({ count: 1 }),
      deleteMany: async () => ({ count: 0 }),
      findMany: async () => [{ language: 'en' }],
      createMany: async () => ({ count: 0 }),
    },
  } as any;

  const tenantConfig = {
    getBrandConfig: async () => ({ i18n: { defaultLanguage: 'es', supportedLanguages: ['es', 'en'] } }),
    getLocationConfig: async () => ({}),
  } as any;

  const tenantContext = {
    getRequestContext: () => buildContext('es'),
  } as any;

  const translationProvider = { translateText: async () => ({ translatedText: 'noop' }) } as any;
  const service = new LocalizationService(prisma, tenantConfig, tenantContext, translationProvider);

  const rows = await service.getEntityTranslations({
    entityType: 'service',
    entityId: 'svc-1',
  });

  assert.equal(updatedSourceLanguage, 'es');
  assert.equal(updatedSourceVersion, 3);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sourceLanguage, 'es');
});
