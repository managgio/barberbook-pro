import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { PrismaFaqRepositoryAdapter } from '@/modules/faqs/adapters/prisma-faq-repository.adapter';
import { DomainError } from '@/shared/domain/domain-error';
import { RequestContext } from '@/shared/application/request-context';

const context: RequestContext = { tenantId: 'a', brandId: 'a', localId: 'local-a', actorUserId: null, timezone: 'Europe/Madrid', correlationId: 'test' };
const content = { question: 'q', answer: 'a' };

const setup = () => {
  let rows: any[] = [{ id: 'a', localId: 'local-a', ...content, position: 0, version: 1 }, { id: 'b', localId: 'local-a', ...content, position: 1, version: 1 }, { id: 'foreign', localId: 'local-b', ...content, position: 0, version: 1 }];
  const calls: Array<{ action: string; args: any }> = [];
  const record = (action: string, args: any) => calls.push({ action, args });
  const tx = {
    $queryRaw: async (_sql: unknown, ...values: unknown[]) => { record('lock', values); return [{ id: 'local-a' }]; },
    faq: {
      findMany: async (args: any) => { record('list', args); return rows.filter((row) => row.localId === args.where.localId).sort((a, b) => a.position - b.position); },
      findFirst: async (args: any) => { record('find', args); return rows.find((row) => row.id === args.where.id && row.localId === args.where.localId); },
      create: async (args: any) => { record('create', args); const row = { id: 'c', version: 1, ...args.data }; rows.push(row); return row; },
      update: async (args: any) => { record('update', args); const row = rows.find((item) => item.id === args.where.id && item.localId === args.where.localId)!; Object.assign(row, args.data, { version: args.data.version ? row.version + 1 : row.version }); return row; },
      delete: async (args: any) => { record('delete', args); rows = rows.filter((row) => !(row.id === args.where.id && row.localId === args.where.localId)); },
    },
    localizedContent: { deleteMany: async (args: any) => record('translations-delete', args) },
  };
  const prisma = { ...tx, $transaction: async (action: (tx: any) => Promise<unknown>) => {
    const before = structuredClone(rows);
    try { return await action(tx); } catch (error) { rows = before; throw error; }
  } };
  const localization = { syncEntitySourceFields: async (args: any) => record('translate', args) };
  return { adapter: new PrismaFaqRepositoryAdapter(prisma as any, localization as any), tx, calls, rows: () => rows, localization };
};

test('FAQ reads and writes remain scoped; source fields participate in the same transaction', async () => {
  const fixture = setup();
  assert.equal((await fixture.adapter.list(context)).length, 2);
  const faq = await fixture.adapter.create(context, content);
  assert.equal(faq.position, 2);
  assert.deepEqual(fixture.calls.find((call) => call.action === 'lock')?.args, ['local-a', 'a']);
  const translation = fixture.calls.find((call) => call.action === 'translate')!.args;
  assert.equal(translation.transaction, fixture.tx);
  assert.equal(translation.context, context);
  assert.equal(translation.entityType, 'faq');
  await fixture.adapter.update(context, faq.id, 1, { question: 'new', answer: 'new' });
  assert.equal(fixture.rows().find((row) => row.id === faq.id)?.version, 2);
});

test('foreign IDs and stale versions cannot update or delete FAQs', async () => {
  const fixture = setup();
  for (const id of ['foreign', 'missing']) {
    await assert.rejects(() => fixture.adapter.update(context, id, 1, content), (error: unknown) => error instanceof DomainError && error.code === 'FAQ_NOT_FOUND');
    await assert.rejects(() => fixture.adapter.remove(context, id, 1));
  }
  await assert.rejects(() => fixture.adapter.update(context, 'a', 2, content), (error: unknown) => error instanceof DomainError && error.code === 'FAQ_CONFLICT');
  assert.equal(fixture.calls.filter((call) => ['update', 'delete', 'translate'].includes(call.action)).length, 0);
});

test('reordering commits positions together and rejects concurrent order changes', async () => {
  const fixture = setup();
  assert.deepEqual((await fixture.adapter.reorder(context, ['a', 'b'], ['b', 'a'])).map((item) => item.id), ['b', 'a']);
  await assert.rejects(() => fixture.adapter.reorder(context, ['a', 'b'], ['a', 'b']), (error: unknown) => error instanceof DomainError && error.code === 'FAQ_CONFLICT');
  assert.equal(fixture.rows().find((row) => row.id === 'foreign')?.position, 0);
});

test('source synchronization failure rolls back content and deletion removes tenant translations', async () => {
  const fixture = setup();
  fixture.localization.syncEntitySourceFields = async () => { throw new Error('unavailable'); };
  await assert.rejects(() => fixture.adapter.create(context, content));
  assert.equal(fixture.rows().length, 3);
  await fixture.adapter.remove(context, 'a', 1);
  assert.deepEqual(fixture.calls.find((call) => call.action === 'translations-delete')?.args.where, { brandId: 'a', localId: 'local-a', entityType: 'faq', entityId: 'a' });
  assert.equal(fixture.rows().length, 2);
});
