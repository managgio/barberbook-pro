import { RequestContext } from '../../../../shared/application/request-context';
import { FaqContent } from '../../domain/services/faq-policy';

export const FAQ_REPOSITORY_PORT = Symbol('FAQ_REPOSITORY_PORT');
export type Faq = FaqContent & { id: string; position: number; version: number };
export interface FaqRepositoryPort {
  list(context: RequestContext): Promise<Faq[]>;
  create(context: RequestContext, content: FaqContent): Promise<Faq>;
  update(context: RequestContext, id: string, version: number, content: FaqContent): Promise<Faq>;
  remove(context: RequestContext, id: string, version: number): Promise<void>;
  reorder(context: RequestContext, expectedIds: string[], orderedIds: string[]): Promise<Faq[]>;
}
