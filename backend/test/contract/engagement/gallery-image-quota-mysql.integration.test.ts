import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { PrismaGalleryRepositoryAdapter } from '@/modules/gallery/adapters/prisma-gallery-repository.adapter';
import { RequestContext } from '@/shared/application/request-context';
import { DomainError } from '@/shared/domain/domain-error';
import { GalleryItem, GalleryWrite } from '@/contexts/engagement/ports/outbound/gallery-repository.port';

const url = process.env.GALLERY_TEST_DATABASE_URL;
const capacityError = (error: unknown) => error instanceof DomainError && error.code === 'GALLERY_IMAGE_LIMIT';

test('gallery MySQL gives five locations independent twelve-image quotas and prevents concurrent overflows', { skip: !url }, async () => {
  const parsed = new URL(url!);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname) && /^\/managgio_(gallery|faq)_test/.test(parsed.pathname));
  const db = new PrismaService({ datasources: { db: { url } } });
  await db.onModuleInit();
  try {
    const suffix = randomUUID();
    const brand = await db.brand.create({ data: { name: 'Image quota', subdomain: `image-quota-${suffix}` } });
    const other = await db.brand.create({ data: { name: 'Other quota', subdomain: `other-quota-${suffix}` } });
    const location = async (brandId: string, name: string): Promise<RequestContext> => {
      const local = await db.location.create({ data: { brandId, name } });
      return { brandId, tenantId: brandId, localId: local.id, actorUserId: null, correlationId: suffix, timezone: 'Europe/Madrid' };
    };
    const a = await location(brand.id, 'A'); const b = await location(brand.id, 'B'); const foreign = await location(other.id, 'Other');
    const repository = new PrismaGalleryRepositoryAdapter(db, { syncEntitySourceFields: async () => {} } as any);
    const catA = await repository.saveCategory(a, null, 'A'); const catB = await repository.saveCategory(b, null, 'B');
    const catForeign = await repository.saveCategory(foreign, null, 'Other');
    const content = (categoryId: string, comparison = false): GalleryWrite => {
      const fileId = randomUUID(); const beforeId = comparison ? randomUUID() : null;
      const media = (id: string) => ({ fileId: id, url: `https://images.test/${id}.webp`, width: 800, height: 1000 });
      return { title: 'Work', description: '', categoryId, imageFileId: fileId, beforeFileId: beforeId,
        image: media(fileId), before: beforeId ? media(beforeId) : null };
    };
    const works: GalleryItem[] = [];
    for (let index = 0; index < 10; index++) works.push(await repository.saveItem(a, null, content(catA.id)));
    const attempts = await Promise.allSettled([
      repository.saveItem(a, null, content(catA.id, true)), repository.saveItem(a, null, content(catA.id, true)),
    ]);
    assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
    assert.ok(capacityError((attempts.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason));
    assert.deepEqual(await repository.imageUsage(a), { used: 12, limit: 12 });
    assert.deepEqual(await repository.imageUsage(b), { used: 0, limit: 12 });
    await repository.saveItem(b, null, content(catB.id, true));
    assert.deepEqual(await repository.imageUsage(b), { used: 2, limit: 12 });
    await repository.saveItem(foreign, null, content(catForeign.id, true));
    assert.deepEqual(await repository.imageUsage(foreign), { used: 2, limit: 12 });
    await assert.rejects(() => repository.saveItem(a, null, content(catA.id)), capacityError);
    await assert.rejects(() => repository.saveItem(a, works[0], content(catA.id, true)), capacityError);

    // Replacing at capacity is allowed and does not consume another slot.
    const replaced = await repository.saveItem(a, works[0], content(catA.id));
    assert.equal(replaced.version, works[0].version + 1);
    assert.equal((await repository.imageUsage(a)).used, 12);
    const winnerIndex = attempts.findIndex((result) => result.status === 'fulfilled');
    const winner = (attempts[winnerIndex] as PromiseFulfilledResult<Awaited<ReturnType<typeof repository.saveItem>>>).value;
    const reduced = await repository.saveItem(a, winner, content(catA.id));
    assert.equal((await repository.imageUsage(a)).used, 11);
    assert.equal((await repository.imageUsage(b)).used, 2);
    await assert.rejects(() => repository.saveItem(a, null, content(catA.id, true)), capacityError);

    const edits = await Promise.allSettled([
      repository.saveItem(a, replaced, content(catA.id, true)),
      repository.saveItem(a, reduced, content(catA.id, true)),
    ]);
    assert.equal(edits.filter((result) => result.status === 'fulfilled').length, 1);
    assert.ok(capacityError((edits.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason));
    assert.equal((await repository.imageUsage(a)).used, 12);
    await repository.removeItem(a, works[1].id, works[1].version);
    await repository.saveItem(a, null, content(catA.id));
    assert.equal((await repository.imageUsage(a)).used, 12);

    const siblings = [b, await location(brand.id, 'C'), await location(brand.id, 'D'), await location(brand.id, 'E')];
    for (const sibling of siblings) {
      const category = sibling === b ? catB : await repository.saveCategory(sibling, null, 'Cortes');
      const used = (await repository.imageUsage(sibling)).used;
      for (let count = used; count < 12; count += 2) await repository.saveItem(sibling, null, content(category.id, true));
      assert.deepEqual(await repository.imageUsage(sibling), { used: 12, limit: 12 });
      await assert.rejects(() => repository.saveItem(sibling, null, content(category.id)), capacityError);
    }
    assert.equal((await Promise.all([a, ...siblings].map((context) => repository.imageUsage(context)))).reduce((sum, usage) => sum + usage.used, 0), 60);
    assert.equal((await repository.list(foreign)).items.length, 1);
  } finally { await db.onModuleDestroy(); }
});
