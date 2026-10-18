import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { assertFaqCapacity, assertFaqOrder, normalizeFaqContent } from '@/contexts/engagement/domain/services/faq-policy';
import { ManageFaqsUseCase } from '@/contexts/engagement/application/use-cases/manage-faqs.use-case';
import { DomainError } from '@/shared/domain/domain-error';
import { RequestContext } from '@/shared/application/request-context';
import { FaqRepositoryPort } from '@/contexts/engagement/ports/outbound/faq-repository.port';

const context: RequestContext = { tenantId: 'a', brandId: 'a', localId: 'local-a', actorUserId: null, timezone: 'Europe/Madrid', correlationId: 'test' };
const code = (expected: string) => (error: unknown) => error instanceof DomainError && error.code === expected;

test('FAQ content trims whitespace, requires both fields and bounds payloads', () => {
  assert.deepEqual(normalizeFaqContent({ question: ' Question? ', answer: ' Answer\n ' }), { question: 'Question?', answer: 'Answer' });
  for (const content of [{ question: ' ', answer: 'a' }, { question: 'q', answer: ' ' }, { question: 'x'.repeat(241), answer: 'a' }, { question: 'q', answer: 'x'.repeat(5001) }]) {
    assert.throws(() => normalizeFaqContent(content), code('FAQ_INVALID'));
  }
  assert.doesNotThrow(() => assertFaqCapacity(49));
  assert.throws(() => assertFaqCapacity(50), code('FAQ_LIMIT'));
});

test('FAQ ordering rejects stale snapshots, duplicates, missing and foreign IDs', () => {
  assert.doesNotThrow(() => assertFaqOrder(['a', 'b'], ['a', 'b'], ['b', 'a']));
  for (const requested of [['a', 'a'], ['a'], ['a', 'other']]) {
    assert.throws(() => assertFaqOrder(['a', 'b'], ['a', 'b'], requested), code('FAQ_INVALID'));
  }
  assert.throws(() => assertFaqOrder(['b', 'a'], ['a', 'b'], ['b', 'a']), code('FAQ_CONFLICT'));
  assert.throws(() => assertFaqOrder(['a', 'b', 'c'], ['a', 'b'], ['b', 'a']), code('FAQ_CONFLICT'));
});

test('disabled FAQ capability exposes no content and blocks every administrative operation', async () => {
  const repository = new Proxy({}, { get: () => () => { throw new Error('Repository must not be called'); } }) as FaqRepositoryPort;
  const useCase = new ManageFaqsUseCase(repository, { getEffectiveConfig: async () => ({}), getBrandConfig: async () => ({}) }, { get: async () => ({ published: true, version: 0 }) } as any);
  assert.deepEqual(await useCase.list(context), []);
  const content = { question: 'q', answer: 'a' };
  for (const operation of [() => useCase.list(context, true), () => useCase.create(context, content), () => useCase.update(context, 'x', 1, content), () => useCase.remove(context, 'x', 1), () => useCase.reorder(context, [], [])]) {
    await assert.rejects(operation, code('FAQ_DISABLED'));
  }
});

test('enabled writes use only request context and normalized content', async () => {
  let captured: unknown[] = [];
  const repository = { create: async (...args: unknown[]) => { captured = args; return { id: 'faq' }; } } as unknown as FaqRepositoryPort;
  const useCase = new ManageFaqsUseCase(repository, { getEffectiveConfig: async () => ({ features: { faqEnabled: true } }), getBrandConfig: async () => ({}) }, { get: async () => ({ published: true, version: 0 }) } as any);
  await useCase.create(context, { question: ' q ', answer: ' a ', localId: 'foreign' } as any);
  assert.deepEqual(captured, [context, { question: 'q', answer: 'a' }]);
});
