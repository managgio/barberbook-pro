import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaGalleryRepositoryAdapter } from '@/modules/gallery/adapters/prisma-gallery-repository.adapter';
import { PrismaLandingPublicationAdapter } from '@/modules/landing-publication/prisma-landing-publication.adapter';
import { LocalizationService } from '@/modules/localization/localization.service';
import { RequestContext } from '@/shared/application/request-context';
import { DomainError } from '@/shared/domain/domain-error';

const url = process.env.GALLERY_TEST_DATABASE_URL;
const code = (expected: string) => (error: unknown) => error instanceof DomainError && error.code === expected;

test('gallery MySQL preserves tenancy, concurrent writes, category integrity, translation atomicity and publication', { skip: !url }, async () => {
  const parsed = new URL(url!);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname) && /^\/managgio_(gallery|faq)_test/.test(parsed.pathname), 'Use an isolated local content test database.');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const suffix = randomUUID();
  try {
    const makeTenant = async (name: string) => {
      const brand = await prisma.brand.create({ data: { name, subdomain: `gallery-${name}-${suffix}` } });
      const location = await prisma.location.create({ data: { brandId: brand.id, name } });
      return { brandId: brand.id, tenantId: brand.id, localId: location.id, actorUserId: null, timezone: 'Europe/Madrid', correlationId: 'gallery-test' } satisfies RequestContext;
    };
    const a = await makeTenant('a'); const b = await makeTenant('b');
    const localization = new LocalizationService(prisma as any, {
      getBrandConfig: async () => ({ features: { galleryEnabled: true }, i18n: { defaultLanguage: 'es', supportedLanguages: ['es', 'en'] } }), getLocationConfig: async () => ({}),
    } as any, { getRequestContext: () => a } as any, {} as any);
    const repository = new PrismaGalleryRepositoryAdapter(prisma as any, localization);
    const publication = new PrismaLandingPublicationAdapter(prisma as any);
    assert.deepEqual(await publication.get(a, 'faq'), { published: true, version: 0 });
    assert.deepEqual(await publication.get(a, 'gallery'), { published: false, version: 0 });
    const visibility = await Promise.allSettled([
      publication.update(a, 'gallery', { published: true, version: 0 }), publication.update(a, 'gallery', { published: true, version: 0 }),
    ]);
    assert.equal(visibility.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal((visibility.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason.code, 'LANDING_SECTION_CONFLICT');
    assert.deepEqual(await publication.get(b, 'gallery'), { published: false, version: 0 });
    await publication.update(a, 'faq', { published: false, version: 0 });
    assert.equal((await publication.get(a, 'gallery')).published, true);
    await assert.rejects(() => publication.update({ ...a, brandId: b.brandId }, 'faq', { published: true, version: 1 }), code('LANDING_SECTION_NOT_FOUND'));

    const category = await repository.saveCategory(a, null, 'Cortes');
    const foreign = await repository.saveCategory(b, null, 'Otro local');
    await assert.rejects(() => repository.saveCategory(a, null, 'cortes'), code('GALLERY_CATEGORY_DUPLICATE'));
    const content = (title: string, categoryId = category.id) => ({ title, description: 'Descripción', categoryId, imageFileId: 'image-a', beforeFileId: null,
      image: { fileId: 'image-a', url: 'https://ik.imagekit.io/test/photo.webp', width: 1000, height: 1200 }, before: null });
    await assert.rejects(() => repository.saveItem(a, null, content('Invalid category', foreign.id)), code('GALLERY_CATEGORY_NOT_FOUND'));
    const [one, two] = await Promise.all([repository.saveItem(a, null, content('Uno')), repository.saveItem(a, null, content('Dos'))]);
    assert.deepEqual((await repository.list(a)).items.map((item) => item.position), [0, 1]);
    assert.equal((await repository.list(b)).items.length, 0);
    await assert.rejects(() => repository.removeItem(b, one.id, 1), code('GALLERY_NOT_FOUND'));
    await assert.rejects(() => repository.removeCategory(a, foreign.id, 1), code('GALLERY_NOT_FOUND'));
    await assert.rejects(() => repository.removeCategory(a, category.id, 1), code('GALLERY_CATEGORY_IN_USE'));
    await assert.rejects(() => prisma.galleryItem.update({ where: { id: one.id }, data: { categoryId: foreign.id } }));
    const edits = await Promise.allSettled([
      repository.saveItem(a, { id: one.id, version: 1 }, content('Edit A')), repository.saveItem(a, { id: one.id, version: 1 }, content('Edit B')),
    ]);
    assert.equal(edits.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal((edits.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason.code, 'GALLERY_CONFLICT');
    const initial = (await repository.list(a)).items.map((item) => item.id);
    const reversed = [...initial].reverse();
    await repository.reorder(a, initial, reversed);
    await assert.rejects(() => repository.reorder(a, initial, reversed), code('GALLERY_CONFLICT'));
    await assert.rejects(() => repository.reorder(a, reversed, [one.id, foreign.id]), code('GALLERY_INVALID'));
    assert.deepEqual((await repository.list(a)).items.map((item) => item.id), reversed);
    const failing = new PrismaGalleryRepositoryAdapter(prisma as any, { syncEntitySourceFields: async () => { throw new Error('rollback'); } } as any);
    await assert.rejects(() => failing.saveItem(a, { id: one.id, version: 2 }, content('Rollback')));
    assert.equal((await repository.list(a)).items.find((item) => item.id === one.id)?.version, 2);
    assert.equal(await prisma.localizedContent.count({ where: { localId: a.localId } }), 5);
    await repository.removeItem(a, one.id, 2);
    assert.equal(await prisma.localizedContentTranslation.count({ where: { localId: a.localId, content: { entityId: one.id } } }), 0);
    await repository.removeItem(a, two.id, 1);
    await repository.removeCategory(a, category.id, 1);
    assert.equal(await prisma.localizedContent.count({ where: { localId: a.localId } }), 0);

    const replacement = await repository.saveCategory(a, null, 'Color');
    const fixture = { ...content('Fixture', replacement.id), localId: a.localId, imageUrl: 'https://ik.imagekit.io/test/photo.webp', imageWidth: 1000, imageHeight: 1200 };
    const { image: _image, before: _before, ...row } = fixture;
    await prisma.galleryItem.createMany({ data: Array.from({ length: 11 }, (_, position) => ({ ...row, position })) });
    const capacity = await Promise.allSettled([
      repository.saveItem(a, null, content('Last A', replacement.id)), repository.saveItem(a, null, content('Last B', replacement.id)),
    ]);
    assert.equal(capacity.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal((capacity.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason.code, 'GALLERY_IMAGE_LIMIT');
    // Deleting a location cascades content even when the category and item both reference it.
    await prisma.location.delete({ where: { id: a.localId } });
    assert.equal(await prisma.galleryItem.count({ where: { localId: a.localId } }), 0);
    assert.equal(await prisma.galleryCategory.count({ where: { localId: a.localId } }), 0);
    assert.equal(await prisma.landingPublication.count({ where: { localId: a.localId } }), 0);
  } finally { await prisma.$disconnect(); }
});

test('gallery MySQL translation worker selects enabled categories and works while skipping disabled tenants', { skip: !url }, async () => {
  const parsed = new URL(url!);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname) && /^\/managgio_(gallery|faq)_test/.test(parsed.pathname));
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const suffix = randomUUID();
  try {
    const makeTenant = async (enabled: boolean) => {
      const brand = await prisma.brand.create({ data: { name: 'Gallery translations', subdomain: `gallery-ai-${enabled}-${suffix}`, config: { create: { data: {
        features: { galleryEnabled: enabled }, ai: { apiKey: 'test-provider' }, i18n: { defaultLanguage: 'es', supportedLanguages: ['es', 'en'] },
      } } } } });
      const local = await prisma.location.create({ data: { brandId: brand.id, name: 'Translations' } });
      return { tenantId: brand.id, brandId: brand.id, localId: local.id, actorUserId: null, timezone: 'Europe/Madrid', correlationId: 'gallery-ai' } satisfies RequestContext;
    };
    const disabled = await makeTenant(false); const enabled = await makeTenant(true);
    // Keep independently running worker tests from consuming one another's queues.
    const workerPrisma = prisma.$extends({ query: { localizedContentTranslation: {
      findMany({ args, query }) {
        args.where = { AND: [args.where ?? {}, { brandId: { in: [disabled.brandId, enabled.brandId] } }] };
        return query(args);
      },
    } } });
    const localization = new LocalizationService(workerPrisma as any, {
      getBrandConfig: async (brandId: string) => (await prisma.brandConfig.findUniqueOrThrow({ where: { brandId } })).data,
      getLocationConfig: async () => ({}),
    } as any, { getRequestContext: () => enabled } as any, { translateText: async () => ({ translatedText: 'Translated' }) } as any);
    const repository = new PrismaGalleryRepositoryAdapter(prisma as any, localization);
    for (const context of [disabled, enabled]) {
      const category = await repository.saveCategory(context, null, 'Cortes');
      await repository.saveItem(context, null, { title: 'Corte', description: 'Descripción', categoryId: category.id, imageFileId: 'image', beforeFileId: null,
        image: { fileId: 'image', url: 'https://ik.imagekit.io/test/image.webp', width: 1000, height: 1200 }, before: null });
    }
    assert.deepEqual(await localization.processPendingTranslations(3), { picked: 3, processed: 3, failed: 0 });
    assert.equal(await prisma.localizedContentTranslation.count({ where: { localId: enabled.localId, status: 'ready' } }), 3);
    assert.equal(await prisma.localizedContentTranslation.count({ where: { localId: disabled.localId, status: 'pending' } }), 3);
  } finally { await prisma.$disconnect(); }
});
