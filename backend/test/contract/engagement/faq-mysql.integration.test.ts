import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaFaqRepositoryAdapter } from '@/modules/faqs/adapters/prisma-faq-repository.adapter';
import { LocalizationService } from '@/modules/localization/localization.service';
import { RequestContext } from '@/shared/application/request-context';
import { DomainError } from '@/shared/domain/domain-error';

const url = process.env.FAQ_TEST_DATABASE_URL;

test('FAQ MySQL transactions preserve tenant isolation, ordering, optimistic edits and translation cleanup', { skip: !url }, async () => {
  const parsed = new URL(url!);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname) && parsed.pathname.startsWith('/managgio_faq_test'), 'Use an isolated local FAQ test database.');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const suffix = randomUUID();
  const context = (brandId: string, localId: string): RequestContext => ({ tenantId: brandId, brandId, localId, actorUserId: null, timezone: 'Europe/Madrid', correlationId: 'faq-integration' });
  try {
    const brandA = await prisma.brand.create({ data: { name: 'FAQ test A', subdomain: `faq-a-${suffix}` } });
    const brandB = await prisma.brand.create({ data: { name: 'FAQ test B', subdomain: `faq-b-${suffix}` } });
    const locationA = await prisma.location.create({ data: { brandId: brandA.id, name: 'A' } });
    const locationB = await prisma.location.create({ data: { brandId: brandB.id, name: 'B' } });
    const a = context(brandA.id, locationA.id);
    const b = context(brandB.id, locationB.id);
    const localization = new LocalizationService(prisma as any, {
      getBrandConfig: async () => ({ features: { faqEnabled: true }, i18n: { defaultLanguage: 'es', supportedLanguages: ['es', 'en'] } }),
      getLocationConfig: async () => ({}),
    } as any, { getRequestContext: () => a } as any, {} as any);
    const repository = new PrismaFaqRepositoryAdapter(prisma as any, localization);
    const [first, second, foreign] = await Promise.all([
      repository.create(a, { question: 'Primera', answer: 'Respuesta' }),
      repository.create(a, { question: 'Segunda', answer: 'Respuesta' }),
      repository.create(b, { question: 'Otro tenant', answer: 'Privada' }),
    ]);
    const initial = await repository.list(a);
    assert.deepEqual(initial.map((item) => item.position), [0, 1]);
    assert.equal(await prisma.localizedContent.count({ where: { localId: a.localId } }), 4);
    assert.equal(await prisma.localizedContentTranslation.count({ where: { localId: a.localId, status: 'pending' } }), 4);
    await assert.rejects(() => repository.update(a, foreign.id, 1, { question: 'Attack', answer: 'Attack' }), (error: unknown) => error instanceof DomainError && error.code === 'FAQ_NOT_FOUND');
    await assert.rejects(() => repository.remove(a, foreign.id, 1));
    assert.equal((await repository.list(b))[0].question, 'Otro tenant');

    await localization.upsertManualTranslation({ context: a, entityType: 'faq', entityId: first.id, fieldKey: 'answer', language: 'en', translatedText: 'Manual answer', manualLocked: true });
    const edits = await Promise.allSettled([
      repository.update(a, first.id, 1, { question: 'Nueva A', answer: 'Nueva A' }),
      repository.update(a, first.id, 1, { question: 'Nueva B', answer: 'Nueva B' }),
    ]);
    assert.equal(edits.filter((result) => result.status === 'fulfilled').length, 1);
    const failure = edits.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    assert.equal(failure.reason.code, 'FAQ_CONFLICT');
    const manual = await prisma.localizedContentTranslation.findFirst({ where: { localId: a.localId, content: { entityId: first.id, fieldKey: 'answer' } } });
    assert.equal(manual?.translatedText, 'Manual answer');
    assert.equal(manual?.status, 'stale');

    const expectedIds = initial.map((item) => item.id);
    const reversed = [...expectedIds].reverse();
    const orders = await Promise.allSettled([
      repository.reorder(a, expectedIds, reversed), repository.reorder(a, expectedIds, reversed),
    ]);
    assert.equal(orders.filter((result) => result.status === 'fulfilled').length, 1);
    assert.deepEqual((await repository.list(a)).map((item) => item.id), reversed);

    const failing = new PrismaFaqRepositoryAdapter(prisma as any, { syncEntitySourceFields: async () => { throw new Error('test rollback'); } } as any);
    await assert.rejects(() => failing.create(a, { question: 'Rollback', answer: 'Rollback' }));
    assert.equal((await repository.list(a)).length, 2);
    await repository.remove(a, first.id, 2);
    assert.equal(await prisma.localizedContent.count({ where: { localId: a.localId, entityId: first.id } }), 0);
    assert.equal(await prisma.localizedContentTranslation.count({ where: { localId: a.localId } }), 2);
    assert.equal((await repository.list(a))[0].id, second.id);
    await prisma.faq.createMany({ data: Array.from({ length: 48 }, (_, index) => ({ localId: a.localId, question: `Limit ${index}`, answer: 'Answer', position: index + 2 })) });
    const capacity = await Promise.allSettled([
      repository.create(a, { question: 'Last slot A', answer: 'Answer' }),
      repository.create(a, { question: 'Last slot B', answer: 'Answer' }),
    ]);
    assert.equal(capacity.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal((capacity.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason.code, 'FAQ_LIMIT');
    assert.equal((await repository.list(a)).length, 50);
  } finally { await prisma.$disconnect(); }
});

test('FAQ MySQL worker skips disabled queues and tolerates deletion during AI generation', { skip: !url }, async () => {
  const parsed = new URL(url!);
  assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname) && parsed.pathname.startsWith('/managgio_faq_test'));
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const suffix = randomUUID();
  try {
    const makeTenant = async (enabled: boolean) => {
      const brand = await prisma.brand.create({ data: { name: 'FAQ worker test', subdomain: `worker-${enabled}-${suffix}`, config: { create: { data: {
        features: { faqEnabled: enabled }, ai: { apiKey: 'test-provider-key' }, i18n: { defaultLanguage: 'es', supportedLanguages: ['es', 'en'] },
      } } } } });
      const local = await prisma.location.create({ data: { brandId: brand.id, name: 'Worker test' } });
      return { brandId: brand.id, tenantId: brand.id, localId: local.id, actorUserId: null, timezone: 'Europe/Madrid', correlationId: 'faq-worker-test' } satisfies RequestContext;
    };
    const disabled = await makeTenant(false);
    const enabled = await makeTenant(true);
    // Keep independently running worker tests from consuming one another's queues.
    const workerPrisma = prisma.$extends({ query: { localizedContentTranslation: {
      findMany({ args, query }) {
        args.where = { AND: [args.where ?? {}, { brandId: { in: [disabled.brandId, enabled.brandId] } }] };
        return query(args);
      },
    } } });
    let firstId: string | undefined;
    let repository: PrismaFaqRepositoryAdapter;
    const localization = new LocalizationService(workerPrisma as any, {
      getBrandConfig: async (brandId: string) => (await prisma.brandConfig.findUniqueOrThrow({ where: { brandId } })).data,
      getLocationConfig: async () => ({}),
    } as any, { getRequestContext: () => enabled } as any, {
      translateText: async () => {
        if (firstId) { const id = firstId; firstId = undefined; await repository.remove(enabled, id, 1); }
        return { translatedText: 'Translated' };
      },
    } as any);
    repository = new PrismaFaqRepositoryAdapter(prisma as any, localization);
    await repository.create(disabled, { question: 'Disabled first', answer: 'Disabled' });
    const first = await repository.create(enabled, { question: 'Delete during generation', answer: 'Delete' });
    await repository.create(enabled, { question: 'Keep', answer: 'Keep' });
    firstId = first.id;
    const result = await localization.processPendingTranslations(10);
    assert.deepEqual(result, { picked: 4, processed: 2, failed: 0 });
    assert.equal(await prisma.localizedContentTranslation.count({ where: { localId: disabled.localId, status: 'pending' } }), 2);
    assert.equal(await prisma.localizedContentTranslation.count({ where: { localId: enabled.localId, status: 'ready' } }), 2);
    assert.equal((await repository.list(enabled)).length, 1);
  } finally { await prisma.$disconnect(); }
});
