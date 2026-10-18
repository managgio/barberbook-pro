import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertGalleryImageCapacity, assertGalleryOrder, GALLERY_LIMITS } from '../../../contexts/engagement/domain/services/gallery-policy';
import { GalleryRepositoryPort, GalleryWrite } from '../../../contexts/engagement/ports/outbound/gallery-repository.port';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestContext } from '../../../shared/application/request-context';
import { DomainError } from '../../../shared/domain/domain-error';
import { LocalizationService } from '../../localization/localization.service';
import { galleryImageUsage } from './prisma-gallery-image-usage';

const itemSelect = {
  id: true, title: true, description: true, categoryId: true, position: true, version: true,
  imageUrl: true, imageFileId: true, imageWidth: true, imageHeight: true,
  beforeUrl: true, beforeFileId: true, beforeWidth: true, beforeHeight: true,
} as const;
const categorySelect = { id: true, name: true, version: true } as const;
const orderBy = [{ position: 'asc' }, { id: 'asc' }] satisfies Prisma.GalleryItemOrderByWithRelationInput[];

@Injectable()
export class PrismaGalleryRepositoryAdapter implements GalleryRepositoryPort {
  constructor(private readonly prisma: PrismaService, private readonly localization: LocalizationService) {}

  imageUsage(context: RequestContext) { return galleryImageUsage(this.prisma, context.localId); }

  async list(context: RequestContext) {
    const [categories, items] = await this.prisma.$transaction([
      this.prisma.galleryCategory.findMany({ where: { localId: context.localId }, select: categorySelect, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: GALLERY_LIMITS.categories }),
      this.prisma.galleryItem.findMany({ where: { localId: context.localId }, select: itemSelect, orderBy, take: GALLERY_LIMITS.items }),
    ]);
    return { categories, items };
  }

  private write<T>(context: RequestContext, action: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(async (tx) => {
      const locations = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM Location WHERE id = ${context.localId} AND brandId = ${context.brandId} FOR UPDATE
      `;
      if (locations.length !== 1) throw new DomainError('Location not found.', 'GALLERY_NOT_FOUND');
      return action(tx);
    });
  }

  saveItem(context: RequestContext, identity: { id: string; version: number } | null, content: GalleryWrite) {
    return this.write(context, async (tx) => {
      const previous = identity ? await this.assertVersion(tx, context.localId, 'item', identity.id, identity.version) : null;
      const category = await tx.galleryCategory.findFirst({ where: { id: content.categoryId, localId: context.localId }, select: { id: true } });
      if (!category) throw new DomainError('Category not found.', 'GALLERY_CATEGORY_NOT_FOUND');
      const usage = await galleryImageUsage(tx, context.localId);
      const previousImages = previous ? 1 + Number('beforeFileId' in previous && previous.beforeFileId !== null) : 0;
      assertGalleryImageCapacity(usage.used, previousImages, 1 + Number(content.before !== null));
      const data = {
        title: content.title, description: content.description, categoryId: content.categoryId,
        imageFileId: content.image.fileId, imageUrl: content.image.url, imageWidth: content.image.width, imageHeight: content.image.height,
        beforeFileId: content.before?.fileId ?? null, beforeUrl: content.before?.url ?? null,
        beforeWidth: content.before?.width ?? null, beforeHeight: content.before?.height ?? null,
      };
      let item;
      if (identity) {
        item = await tx.galleryItem.update({ where: { id: identity.id, localId: context.localId, version: identity.version }, data: { ...data, version: { increment: 1 } }, select: itemSelect });
      } else {
        const count = await tx.galleryItem.count({ where: { localId: context.localId } });
        if (count >= GALLERY_LIMITS.items) throw new DomainError('Gallery limit reached.', 'GALLERY_LIMIT');
        const last = await tx.galleryItem.findFirst({ where: { localId: context.localId }, orderBy: { position: 'desc' }, select: { position: true } });
        item = await tx.galleryItem.create({ data: { ...data, localId: context.localId, position: (last?.position ?? -1) + 1 }, select: itemSelect });
      }
      await this.localization.syncEntitySourceFields({ context, transaction: tx, entityType: 'gallery_item', entityId: item.id,
        fields: { title: content.title, description: content.description } });
      return item;
    });
  }

  removeItem(context: RequestContext, id: string, version: number) {
    return this.write(context, async (tx) => {
      await this.assertVersion(tx, context.localId, 'item', id, version);
      await tx.localizedContent.deleteMany({ where: { brandId: context.brandId, localId: context.localId, entityType: 'gallery_item', entityId: id } });
      await tx.galleryItem.delete({ where: { id, localId: context.localId, version } });
      // Media remain in the tenant asset library; deleting a work must not destroy a reused image.
    });
  }

  reorder(context: RequestContext, expected: string[], ordered: string[]) {
    return this.write(context, async (tx) => {
      const current = await tx.galleryItem.findMany({ where: { localId: context.localId }, select: itemSelect, orderBy });
      assertGalleryOrder(current.map((item) => item.id), expected, ordered);
      const byId = new Map(current.map((item) => [item.id, item]));
      const result = [];
      for (const [position, id] of ordered.entries()) {
        const item = byId.get(id)!;
        if (item.position !== position) await tx.galleryItem.update({ where: { id, localId: context.localId }, data: { position } });
        result.push({ ...item, position });
      }
      return result;
    });
  }

  saveCategory(context: RequestContext, identity: { id: string; version: number } | null, name: string) {
    return this.write(context, async (tx) => {
      if (identity) await this.assertVersion(tx, context.localId, 'category', identity.id, identity.version);
      const duplicate = await tx.galleryCategory.findFirst({ where: { localId: context.localId, name, ...(identity ? { id: { not: identity.id } } : {}) }, select: { id: true } });
      if (duplicate) throw new DomainError('Category already exists.', 'GALLERY_CATEGORY_DUPLICATE');
      let category;
      if (identity) {
        category = await tx.galleryCategory.update({ where: { id: identity.id, localId: context.localId, version: identity.version }, data: { name, version: { increment: 1 } }, select: categorySelect });
      } else {
        const count = await tx.galleryCategory.count({ where: { localId: context.localId } });
        if (count >= GALLERY_LIMITS.categories) throw new DomainError('Category limit reached.', 'GALLERY_LIMIT');
        category = await tx.galleryCategory.create({ data: { localId: context.localId, name }, select: categorySelect });
      }
      await this.localization.syncEntitySourceFields({ context, transaction: tx, entityType: 'gallery_category', entityId: category.id, fields: { name } });
      return category;
    });
  }

  removeCategory(context: RequestContext, id: string, version: number) {
    return this.write(context, async (tx) => {
      await this.assertVersion(tx, context.localId, 'category', id, version);
      if (await tx.galleryItem.count({ where: { localId: context.localId, categoryId: id } })) {
        throw new DomainError('Category has works.', 'GALLERY_CATEGORY_IN_USE');
      }
      await tx.localizedContent.deleteMany({ where: { brandId: context.brandId, localId: context.localId, entityType: 'gallery_category', entityId: id } });
      await tx.galleryCategory.delete({ where: { id, localId: context.localId, version } });
    });
  }

  private async assertVersion(tx: Prisma.TransactionClient, localId: string, type: 'item' | 'category', id: string, version: number) {
    const current = type === 'item'
      ? await tx.galleryItem.findFirst({ where: { id, localId }, select: { version: true, beforeFileId: true } })
      : await tx.galleryCategory.findFirst({ where: { id, localId }, select: { version: true } });
    if (!current) throw new DomainError('Gallery content not found.', 'GALLERY_NOT_FOUND');
    if (current.version !== version) throw new DomainError('Gallery content changed.', 'GALLERY_CONFLICT');
    return current;
  }
}
