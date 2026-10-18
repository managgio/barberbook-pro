import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { WebsiteConfigStore } from '@/modules/website/website-config.store';
import { PrismaWebsiteMediaAdapter } from '@/modules/website/prisma-website-media.adapter';
import { WebsiteMediaCleanup } from '@/modules/website/website-media-cleanup';
import { configRevision } from '@/modules/website/config-revision';
import { RequestContext } from '@/shared/application/request-context';
import { DomainError } from '@/shared/domain/domain-error';
import { PrismaStripePaymentManagementAdapter } from '@/modules/payments/adapters/prisma-stripe-payment-management.adapter';
import { LocalizationService } from '@/modules/localization/localization.service';
import { HeadingFont } from '@/contexts/platform/domain/services/landing-appearance.policy';

const url = process.env.WEBSITE_TEST_DATABASE_URL;
test('website MySQL synchronises Platform and local edits, fences stale writes and safely retries deletion', { skip: !url }, async () => {
  const parsed = new URL(url!);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname) && /^\/managgio_(website|gallery|faq)_test/.test(parsed.pathname));
  const db = new PrismaService({ datasources: { db: { url } } }); await db.onModuleInit();
  const suffix = randomUUID();
  const brandIds: string[] = [];
  try {
    const brand = await db.brand.create({ data: { name: 'Website test', subdomain: `website-${suffix}` } }); brandIds.push(brand.id);
    const other = await db.brand.create({ data: { name: 'Other website', subdomain: `other-website-${suffix}` } }); brandIds.push(other.id);
    const makeLocal = async (brandId: string): Promise<RequestContext> => {
      const local = await db.location.create({ data: { brandId, name: 'Website test' } });
      return { tenantId: brandId, brandId, localId: local.id, timezone: 'Europe/Madrid', actorUserId: null, correlationId: suffix };
    };
    const a = await makeLocal(brand.id), b = await makeLocal(brand.id), foreign = await makeLocal(other.id);
    const image = (id: string) => ({ fileId: `${suffix}-${id}`, url: `https://images.test/${suffix}-${id}.webp` });
    const branded = image('brand');
    const storedBrand = { adminSidebar: { visibleSections: ['website'] }, imagekit: { privateKey: 'never-public' }, branding: { heroImageUrl: branded.url, heroImageFileId: branded.fileId }, landing: { hiddenSections: ['cta'] } };
    await db.brandConfig.create({ data: { brandId: brand.id, data: storedBrand } });
    const deleted: string[] = []; let providerFails = false;
    const provider = { remove: async (_brand: string, fileId: string) => { if (providerFails) throw new Error('provider-offline'); deleted.push(fileId); } } as any;
    const cleanup = new WebsiteMediaCleanup(db, provider);
    // Flush explicitly so assertions can inspect each committed state before the worker runs.
    let resolvingFont: (() => Promise<void>) | null = null;
    const fonts = { resolveFont: async (target: string, _local: string | null, font: HeadingFont) => {
      assert.equal(target, brand.id);
      if (resolvingFont) await resolvingFont();
      return { ...font, url: `https://images.test/${font.fileId}.ttf` };
    } };
    const store = new WebsiteConfigStore(db, { flush: async () => {} } as any, fonts as any);
    const repository = new PrismaWebsiteMediaAdapter(db, store, {} as any);
    const original = await repository.read(a);
    assert.equal(JSON.stringify(original).includes('never-public'), false);
    assert.deepEqual(original.sections.find((section) => section.key === 'hero')?.images, [branded]);
    assert.equal(original.sections.some((section) => section.key === 'cta'), false);
    await assert.rejects(() => repository.read({ ...a, localId: foreign.localId }), NotFoundException);
    const oldPlatformLocalRevision = configRevision({});
    const saved = await repository.save(a, original.revision, 'hero', [image('local')]);
    const localRow = await db.locationConfig.findUniqueOrThrow({ where: { localId: a.localId } });
    assert.equal((localRow.data as any).branding.heroImageUrl, image('local').url);
    assert.deepEqual((await repository.read(b)).sections[0].images, [branded]);
    await assert.rejects(() => store.savePlatform(brand.id, a.localId, { _revision: oldPlatformLocalRevision }), ConflictException);
    const platformData = { ...(localRow.data as any), _revision: configRevision(localRow.data), branding: { heroImageUrl: image('platform').url, heroImageFileId: image('platform').fileId } };
    await store.savePlatform(brand.id, a.localId, platformData);
    assert.deepEqual((await repository.read(a)).sections[0].images, [image('platform')]);
    await assert.rejects(() => repository.save(a, saved.revision, 'hero', [image('stale')]), (error: unknown) => error instanceof DomainError && error.code === 'WEBSITE_CONFLICT');
    await cleanup.flush(brand.id);
    assert.deepEqual(deleted, [image('local').fileId]);
    assert.equal(deleted.includes(branded.fileId), false);

    const current = await repository.read(a);
    const concurrent = await Promise.allSettled([repository.save(a, current.revision, 'hero', [image('first')]), repository.save(a, current.revision, 'hero', [image('second')])]);
    assert.equal(concurrent.filter((result) => result.status === 'fulfilled').length, 1);
    const winner = (await repository.read(a)).sections[0].images[0];
    await cleanup.flush(brand.id);
    assert.equal(deleted.includes(winner.fileId), false);

    // A file shared by another local must survive replacement. The final removal releases it.
    await store.savePlatform(brand.id, b.localId, { _revision: configRevision({}), branding: { heroImageUrl: winner.url, heroImageFileId: winner.fileId } });
    await repository.save(a, (await repository.read(a)).revision, 'hero', [image('final')]);
    await cleanup.flush(brand.id);
    assert.equal(deleted.includes(winner.fileId), false);
    await repository.save(b, (await repository.read(b)).revision, 'hero', []);
    providerFails = true; await cleanup.flush(brand.id);
    const retry = await db.websiteMediaDeletion.findUniqueOrThrow({ where: { brandId_fileId: { brandId: brand.id, fileId: winner.fileId } } });
    assert.equal(retry.status, 'deleting'); assert.equal(retry.attempts, 1);
    await assert.rejects(async () => repository.save(a, (await repository.read(a)).revision, 'hero', [winner]), ConflictException);
    providerFails = false;
    await db.websiteMediaDeletion.update({ where: { id: retry.id, brandId: brand.id }, data: { nextAttempt: new Date(0) } });
    await cleanup.flush(brand.id); await cleanup.flush(brand.id);
    assert.equal(deleted.filter((id) => id === winner.fileId).length, 1);
    assert.equal((await db.websiteMediaDeletion.findUniqueOrThrow({ where: { brandId_fileId: { brandId: brand.id, fileId: winner.fileId } } })).status, 'deleted');

    // Background config writers share the image transaction lock and preserve one another's fields.
    const payments = new PrismaStripePaymentManagementAdapter(db, {} as any, {} as any, {} as any, {} as any);
    const localization = new LocalizationService(db, {} as any, {} as any, {} as any);
    await Promise.all([
      (payments as any).updateBrandStripeConfig(brand.id, { enabled: true }),
      (payments as any).updateLocationStripeConfig(a.localId, { enabled: true }),
      (localization as any).setAutoTranslatePause({ brandId: brand.id, localId: a.localId, pauseUntil: '2099-01-01T00:00:00Z', reason: 'test' }),
    ]);
    const preserved = (await db.locationConfig.findUniqueOrThrow({ where: { localId: a.localId } })).data as any;
    assert.equal(preserved.branding.heroImageFileId, image('final').fileId);
    assert.equal(preserved.payments.stripe.enabled, true);
    assert.equal(preserved.i18n.autoTranslate.paused, true);
    assert.equal(((await db.brandConfig.findUniqueOrThrow({ where: { brandId: brand.id } })).data as any).branding.heroImageFileId, branded.fileId);

    // Font publication uses the same revision fence and reference-aware retirement as photos.
    const saveAppearance = async (theme: object) => {
      const row = await db.brandConfig.findUniqueOrThrow({ where: { brandId: brand.id } });
      return store.savePlatform(brand.id, null, { ...(row.data as any), _revision: configRevision(row.data), theme });
    };
    const font = { fileId: `${suffix}-font`, url: 'https://untrusted.test/ignored.ttf', name: 'Brand font', format: 'ttf' };
    await saveAppearance({ primary: '#a46c42', secondary: '#533123', headingFont: font });
    let appearance = ((await db.brandConfig.findUniqueOrThrow({ where: { brandId: brand.id } })).data as any).theme;
    assert.equal(appearance.headingFont.url, `https://images.test/${font.fileId}.ttf`);
    assert.equal(appearance.secondary, '#533123');
    assert.equal(deleted.includes(font.fileId), false);
    resolvingFont = async () => { await (payments as any).updateBrandStripeConfig(brand.id, { enabled: false }); };
    await assert.rejects(() => saveAppearance({ ...appearance, headingFont: { ...font, fileId: `${suffix}-stale-font` } }), ConflictException);
    resolvingFont = null;
    appearance = ((await db.brandConfig.findUniqueOrThrow({ where: { brandId: brand.id } })).data as any).theme;
    assert.equal(appearance.headingFont.fileId, font.fileId);
    assert.equal(await db.websiteMediaDeletion.count({ where: { brandId: brand.id, fileId: font.fileId } }), 0);
    await saveAppearance({ ...appearance, secondary: null, headingFont: null });
    assert.equal((await db.websiteMediaDeletion.findUniqueOrThrow({ where: { brandId_fileId: { brandId: brand.id, fileId: font.fileId } } })).status, 'pending');
    await cleanup.flush(brand.id);
    assert.equal(deleted.filter(id => id === font.fileId).length, 1);
    await assert.rejects(() => saveAppearance({ ...appearance, headingFont: font }), ConflictException);

    // Platform revocation is checked again inside the transaction, even with an old open editor.
    const beforeRevocation = await repository.read(a);
    const brandRow = await db.brandConfig.findUniqueOrThrow({ where: { brandId: brand.id } });
    await store.savePlatform(brand.id, null, { ...(brandRow.data as any), _revision: configRevision(brandRow.data), adminSidebar: { visibleSections: [] } });
    await assert.rejects(() => repository.read(a), (error: unknown) => error instanceof DomainError && error.code === 'WEBSITE_DISABLED');
    await assert.rejects(() => repository.save(a, beforeRevocation.revision, 'hero', [image('denied')]), (error: unknown) => error instanceof DomainError);
  } finally {
    for (const brandId of brandIds) { await db.location.deleteMany({ where: { brandId } }); await db.brand.delete({ where: { id: brandId } }); }
    await db.onModuleDestroy();
  }
});
