import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { LocalizationService } from '@/modules/localization/localization.service';

const makeFixture = (options: { enabled?: boolean; entityType?: 'faq' | 'gallery_item' | 'gallery_category'; autoTranslate?: boolean; fail?: boolean; count?: number } = {}) => {
  const writes: any[] = [];
  let translations = 0;
  const row = {
    id: 'translation-a', brandId: 'brand-a', localId: 'local-a', language: 'en', contentId: 'content-a',
    updatedAt: new Date('2026-10-18T12:00:00Z'),
    content: { entityType: options.entityType ?? 'faq', sourceText: 'Pregunta', sourceLanguage: 'es', sourceVersion: 3 },
  };
  const service = new LocalizationService({ localizedContentTranslation: {
    findMany: async ({ where }: any) => {
      assert.deepEqual(where.OR, [
        { content: { entityType: { notIn: ['faq', 'gallery_item', 'gallery_category'] } } },
        { content: { entityType: 'faq' }, brand: { config: { data: { path: '$.features.faqEnabled', equals: true } } } },
        { content: { entityType: { in: ['gallery_item', 'gallery_category'] } }, brand: { config: { data: { path: '$.features.galleryEnabled', equals: true } } } },
      ]);
      return [row];
    },
    updateMany: async (args: any) => { writes.push(args); return { count: options.count ?? 1 }; },
  } } as any, {
    getBrandConfig: async () => ({ features: { faqEnabled: options.enabled ?? true, galleryEnabled: options.enabled ?? true }, ai: { apiKey: 'test-key' }, i18n: { defaultLanguage: 'es', supportedLanguages: ['es', 'en'], autoTranslate: { enabled: options.autoTranslate ?? true, retryAttempts: 1 } } }),
    getLocationConfig: async () => ({}),
  } as any, { getRequestContext: () => ({ brandId: 'brand-a', localId: 'local-a' }) } as any, {
    translateText: async () => { translations++; if (options.fail) throw new Error('TEST_PROVIDER_FAILURE'); return { translatedText: 'Question' }; },
  } as any);
  return { service, row, writes, translations: () => translations };
};

test('AI completion cannot overwrite a changed or deleted FAQ translation', async () => {
  const fixture = makeFixture({ count: 0 });
  const result = await fixture.service.processPendingTranslations();
  assert.equal(result.processed, 0);
  assert.equal(fixture.translations(), 1);
  assert.deepEqual(fixture.writes[0].where, {
    id: 'translation-a', brandId: 'brand-a', localId: 'local-a', status: 'pending', manualLocked: false,
    updatedAt: fixture.row.updatedAt, content: { sourceVersion: 3 },
  });
});

test('AI failure after deletion does not fail the batch or mark a newer translation as failed', async () => {
  const fixture = makeFixture({ fail: true, count: 0 });
  assert.deepEqual(await fixture.service.processPendingTranslations(), { picked: 1, processed: 0, failed: 0 });
  assert.equal(fixture.writes[0].where.content.sourceVersion, 3);
  assert.equal(fixture.writes[0].data.status, 'failed');
});

test('AI translations run only while both FAQ and automatic translation are enabled', async () => {
  for (const options of [{ enabled: false }, { autoTranslate: false }]) {
    const fixture = makeFixture(options);
    assert.equal((await fixture.service.processPendingTranslations()).processed, 0);
    assert.equal(fixture.translations(), 0);
    assert.equal(fixture.writes.length, 0);
  }
  const fixture = makeFixture();
  assert.equal((await fixture.service.processPendingTranslations()).processed, 1);
  assert.equal(fixture.writes[0].data.translatedText, 'Question');
});

test('disabled FAQ capability also blocks generic localization management endpoints', async () => {
  const { service } = makeFixture({ enabled: false });
  const target = { entityType: 'faq' as const, entityId: 'faq-a' };
  for (const operation of [
    () => service.getEntityTranslations(target),
    () => service.getEntityTranslationSummaries({ entityType: 'faq', entityIds: ['faq-a'] }),
    () => service.queueRegeneration(target),
    () => service.upsertManualTranslation({ ...target, fieldKey: 'question', language: 'en', translatedText: 'Question' }),
  ]) await assert.rejects(operation, (error: unknown) => error instanceof ForbiddenException);
});

test('gallery translation jobs honor both capability and AI settings and retain concurrency protection', async () => {
  for (const entityType of ['gallery_item', 'gallery_category'] as const) {
    for (const settings of [{ enabled: false }, { autoTranslate: false }]) {
      const fixture = makeFixture({ entityType, ...settings });
      assert.equal((await fixture.service.processPendingTranslations()).processed, 0);
      assert.equal(fixture.translations(), 0);
    }
    const enabled = makeFixture({ entityType });
    assert.equal((await enabled.service.processPendingTranslations()).processed, 1);
    assert.equal(enabled.writes[0].where.content.sourceVersion, 3);
  }
});
