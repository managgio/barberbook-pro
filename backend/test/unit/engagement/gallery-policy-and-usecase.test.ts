import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ManageGalleryUseCase } from '@/contexts/engagement/application/use-cases/manage-gallery.use-case';
import { ManageFaqsUseCase } from '@/contexts/engagement/application/use-cases/manage-faqs.use-case';
import { ManageLandingPublicationUseCase } from '@/contexts/engagement/application/use-cases/manage-landing-publication.use-case';
import { assertGalleryImageCapacity, assertGalleryOrder, normalizeGalleryContent, normalizeGalleryName } from '@/contexts/engagement/domain/services/gallery-policy';
import { DomainError } from '@/shared/domain/domain-error';
import { RequestContext } from '@/shared/application/request-context';

const context: RequestContext = { brandId: 'a', tenantId: 'a', localId: 'local-a', actorUserId: null, correlationId: 'test', timezone: 'Europe/Madrid' };
const content = { title: ' Title ', description: ' Description ', categoryId: 'cat-a', imageFileId: 'image-a', beforeFileId: null };
const code = (expected: string) => (error: unknown) => error instanceof DomainError && error.code === expected;
const config = (enabled: boolean) => ({ getEffectiveConfig: async () => ({ features: { galleryEnabled: enabled, faqEnabled: enabled } }), getBrandConfig: async () => ({}) });

test('gallery normalizes source text and rejects oversized, blank and invalid image inputs', () => {
  assert.equal(normalizeGalleryName('  Cortes  '), 'Cortes');
  assert.deepEqual(normalizeGalleryContent({ ...content, localId: 'other' } as any), { ...content, title: 'Title', description: 'Description' });
  for (const input of [{ ...content, title: ' ' }, { ...content, title: 'a'.repeat(121) }, { ...content, description: 'a'.repeat(2001) },
    { ...content, imageFileId: '../file' }, { ...content, beforeFileId: 'image-a' }, { ...content, categoryId: '' }]) {
    assert.throws(() => normalizeGalleryContent(input), code('GALLERY_INVALID'));
  }
  assert.throws(() => normalizeGalleryName(' '), code('GALLERY_INVALID'));
  assert.throws(() => normalizeGalleryName('a'.repeat(81)), code('GALLERY_INVALID'));
});

test('gallery order accepts only an exact permutation of the current snapshot', () => {
  assert.doesNotThrow(() => assertGalleryOrder(['a', 'b'], ['a', 'b'], ['b', 'a']));
  assert.throws(() => assertGalleryOrder(['b', 'a'], ['a', 'b'], ['b', 'a']), code('GALLERY_CONFLICT'));
  for (const ordered of [['a', 'a'], ['a'], ['a', 'foreign']]) {
    assert.throws(() => assertGalleryOrder(['a', 'b'], ['a', 'b'], ordered), code('GALLERY_INVALID'));
  }
});

test('disabled gallery exposes nothing and blocks all writes before touching media or repositories', async () => {
  const forbidden = new Proxy({}, { get: () => () => { throw new Error('must not be called'); } });
  const useCase = new ManageGalleryUseCase(forbidden as any, config(false), forbidden as any, forbidden as any);
  assert.deepEqual(await useCase.list(context), { categories: [], items: [] });
  for (const operation of [() => useCase.list(context, true), () => useCase.saveItem(context, null, content), () => useCase.removeItem(context, 'a', 1),
    () => useCase.reorder(context, [], []), () => useCase.saveCategory(context, null, 'Name'), () => useCase.removeCategory(context, 'a', 1)]) {
    await assert.rejects(operation, code('GALLERY_DISABLED'));
  }
});

test('FAQ and gallery drafts remain editable but never reach public readers', async () => {
  const publication = { get: async () => ({ published: false, version: 2 }) };
  let reads = 0;
  const gallery = new ManageGalleryUseCase({ list: async () => { reads++; return { items: [{ id: 'work' }], categories: [] }; }, imageUsage: async () => ({ used: 1, limit: 12 }) } as any, config(true), publication as any, {} as any);
  const faq = new ManageFaqsUseCase({ list: async () => { reads++; return [{ id: 'faq' }]; } } as any, config(true), publication as any);
  assert.deepEqual(await gallery.list(context), { categories: [], items: [] });
  assert.deepEqual(await faq.list(context), []);
  assert.equal(reads, 0);
  assert.equal((await gallery.list(context, true)).items.length, 1);
  assert.equal((await faq.list(context, true)).length, 1);
});

test('gallery image capacity counts comparisons and permits replacements or reductions of legacy collections', () => {
  for (const [used, previous, next] of [[11, 0, 1], [10, 0, 2], [12, 1, 1], [12, 2, 1], [16, 2, 2], [16, 2, 1]]) {
    assert.doesNotThrow(() => assertGalleryImageCapacity(used, previous, next));
  }
  for (const [used, previous, next] of [[12, 0, 1], [11, 0, 2], [12, 1, 2], [16, 0, 1], [16, 1, 2]]) {
    assert.throws(() => assertGalleryImageCapacity(used, previous, next), code('GALLERY_IMAGE_LIMIT'));
  }
});

test('only administrative gallery reads expose current location image usage', async () => {
  let usageReads = 0;
  const gallery = new ManageGalleryUseCase({
    list: async () => ({ items: [], categories: [] }),
    imageUsage: async (ctx: RequestContext) => { assert.equal(ctx, context); usageReads++; return { used: 8, limit: 12 }; },
  } as any, config(true), { get: async () => ({ published: true }) } as any, {} as any);
  assert.deepEqual(await gallery.list(context), { items: [], categories: [] });
  assert.equal(usageReads, 0);
  assert.deepEqual(await gallery.list(context, true), { items: [], categories: [], imageUsage: { used: 8, limit: 12 } });
});

test('gallery saves only verified media and uses the request tenant for both images', async () => {
  const mediaCalls: unknown[] = [];
  let captured: any[] = [];
  const useCase = new ManageGalleryUseCase({ saveItem: async (...args: any[]) => { captured = args; } } as any, config(true), {} as any, {
    resolve: async (ctx, id) => { mediaCalls.push([ctx, id]); return { fileId: id, url: `https://image.test/${id}`, width: 1000, height: 1200 }; },
  });
  await useCase.saveItem(context, { id: 'work', version: 3 }, { ...content, beforeFileId: 'before-a' });
  assert.deepEqual(mediaCalls, [[context, 'image-a'], [context, 'before-a']]);
  assert.equal(captured[0], context);
  assert.deepEqual(captured[1], { id: 'work', version: 3 });
  assert.equal(captured[2].title, 'Title');
  assert.equal(captured[2].before.fileId, 'before-a');
});

test('publication changes require the corresponding platform capability', async () => {
  let calls = 0;
  const repository = { get: async () => { calls++; return { published: false, version: 0 }; }, update: async (...args: any[]) => { calls++; return args[2]; } };
  const disabled = new ManageLandingPublicationUseCase(repository, config(false));
  for (const section of ['faq', 'gallery'] as const) {
    await assert.rejects(() => disabled.get(context, section), code('LANDING_SECTION_DISABLED'));
    await assert.rejects(() => disabled.update(context, section, { published: true, version: 0 }), code('LANDING_SECTION_DISABLED'));
  }
  assert.equal(calls, 0);
  const enabled = new ManageLandingPublicationUseCase(repository, config(true));
  assert.deepEqual(await enabled.update(context, 'gallery', { published: true, version: 0 }), { published: true, version: 0 });
});
