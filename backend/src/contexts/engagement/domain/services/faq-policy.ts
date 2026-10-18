import { DomainError } from '../../../../shared/domain/domain-error';

export const FAQ_LIMITS = { items: 50, question: 240, answer: 5000 } as const;
export type FaqContent = { question: string; answer: string };

export const normalizeFaqContent = (content: FaqContent): FaqContent => {
  const question = content.question.trim();
  const answer = content.answer.trim();
  if (!question || !answer || question.length > FAQ_LIMITS.question || answer.length > FAQ_LIMITS.answer) {
    throw new DomainError('Invalid FAQ content.', 'FAQ_INVALID');
  }
  return { question, answer };
};

export const assertFaqCapacity = (count: number) => {
  if (count >= FAQ_LIMITS.items) throw new DomainError('FAQ limit reached.', 'FAQ_LIMIT');
};

export const assertFaqOrder = (currentIds: string[], expectedIds: string[], orderedIds: string[]) => {
  if (currentIds.length !== expectedIds.length || currentIds.some((id, index) => id !== expectedIds[index])) {
    throw new DomainError('FAQ order has changed.', 'FAQ_CONFLICT');
  }
  const ids = new Set(orderedIds);
  if (ids.size !== currentIds.length || orderedIds.length !== currentIds.length || currentIds.some((id) => !ids.has(id))) {
    throw new DomainError('Invalid FAQ order.', 'FAQ_INVALID');
  }
};
