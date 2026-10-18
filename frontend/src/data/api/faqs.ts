import { apiRequest } from './request';

export type Faq = { id: string; question: string; answer: string; position: number; version: number };
export type FaqContent = Pick<Faq, 'question' | 'answer'>;
export const FAQ_LIMITS = { items: 50, question: 240, answer: 5000 } as const;

export const getFaqs = (administrative = false, signal?: AbortSignal) =>
  apiRequest<Faq[]>(administrative ? '/admin/faqs' : '/faqs', { signal });
export const createFaq = (content: FaqContent) =>
  apiRequest<Faq>('/admin/faqs', { method: 'POST', body: content });
export const updateFaq = (id: string, version: number, content: FaqContent) =>
  apiRequest<Faq>(`/admin/faqs/${id}`, { method: 'PATCH', body: { ...content, version } });
export const deleteFaq = (id: string, version: number) =>
  apiRequest<void>(`/admin/faqs/${id}`, { method: 'DELETE', body: { version } });
export const reorderFaqs = (expectedIds: string[], orderedIds: string[]) =>
  apiRequest<Faq[]>('/admin/faqs/order', { method: 'PATCH', body: { expectedIds, orderedIds } });
