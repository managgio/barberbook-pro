import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertFaqCapacity, assertFaqOrder, FaqContent, FAQ_LIMITS } from '../../../contexts/engagement/domain/services/faq-policy';
import { FaqRepositoryPort } from '../../../contexts/engagement/ports/outbound/faq-repository.port';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestContext } from '../../../shared/application/request-context';
import { DomainError } from '../../../shared/domain/domain-error';
import { LocalizationService } from '../../localization/localization.service';

const select = { id: true, question: true, answer: true, position: true, version: true } as const;
const orderBy = [{ position: 'asc' }, { id: 'asc' }] satisfies Prisma.FaqOrderByWithRelationInput[];

@Injectable()
export class PrismaFaqRepositoryAdapter implements FaqRepositoryPort {
  constructor(private readonly prisma: PrismaService, private readonly localization: LocalizationService) {}

  list(context: RequestContext) {
    return this.prisma.faq.findMany({ where: { localId: context.localId }, select, orderBy, take: FAQ_LIMITS.items });
  }

  private write<T>(context: RequestContext, action: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(async (tx) => {
      // The parent lock also serializes the first insertion into an empty FAQ list.
      const locations = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM Location WHERE id = ${context.localId} AND brandId = ${context.brandId} FOR UPDATE
      `;
      if (locations.length !== 1) throw new DomainError('Location not found.', 'FAQ_NOT_FOUND');
      return action(tx);
    });
  }

  create(context: RequestContext, content: FaqContent) {
    return this.write(context, async (tx) => {
      const existing = await tx.faq.findMany({ where: { localId: context.localId }, select: { position: true }, orderBy });
      assertFaqCapacity(existing.length);
      const faq = await tx.faq.create({
        data: { ...content, localId: context.localId, position: (existing.at(-1)?.position ?? -1) + 1 }, select,
      });
      await this.localization.syncEntitySourceFields({ context, transaction: tx, entityType: 'faq', entityId: faq.id, fields: content });
      return faq;
    });
  }

  update(context: RequestContext, id: string, version: number, content: FaqContent) {
    return this.write(context, async (tx) => {
      await this.assertVersion(tx, context.localId, id, version);
      const faq = await tx.faq.update({
        where: { id, localId: context.localId, version }, data: { ...content, version: { increment: 1 } }, select,
      });
      await this.localization.syncEntitySourceFields({ context, transaction: tx, entityType: 'faq', entityId: id, fields: content });
      return faq;
    });
  }

  remove(context: RequestContext, id: string, version: number) {
    return this.write(context, async (tx) => {
      await this.assertVersion(tx, context.localId, id, version);
      await tx.localizedContent.deleteMany({ where: { brandId: context.brandId, localId: context.localId, entityType: 'faq', entityId: id } });
      await tx.faq.delete({ where: { id, localId: context.localId, version } });
    });
  }

  reorder(context: RequestContext, expectedIds: string[], orderedIds: string[]) {
    return this.write(context, async (tx) => {
      const current = await tx.faq.findMany({ where: { localId: context.localId }, select, orderBy });
      assertFaqOrder(current.map((item) => item.id), expectedIds, orderedIds);
      const byId = new Map(current.map((item) => [item.id, item]));
      // Bounded by FAQ_LIMITS; all positions commit together under the tenant lock.
      const result = [];
      for (const [position, id] of orderedIds.entries()) {
        const item = byId.get(id)!;
        if (item.position !== position) {
          await tx.faq.update({ where: { id, localId: context.localId }, data: { position } });
        }
        result.push({ ...item, position });
      }
      return result;
    });
  }

  private async assertVersion(tx: Prisma.TransactionClient, localId: string, id: string, version: number) {
    const faq = await tx.faq.findFirst({ where: { id, localId }, select: { version: true } });
    if (!faq) throw new DomainError('FAQ not found.', 'FAQ_NOT_FOUND');
    if (faq.version !== version) throw new DomainError('FAQ has changed.', 'FAQ_CONFLICT');
  }
}
