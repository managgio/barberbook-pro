import { Prisma } from '@prisma/client';
import { GALLERY_LIMITS } from '../../../contexts/engagement/domain/services/gallery-policy';

export async function galleryImageUsage(db: Prisma.TransactionClient, localId: string) {
  const counts = await db.galleryItem.aggregate({
    where: { localId },
    _count: { _all: true, beforeFileId: true },
  });
  return { used: counts._count._all + counts._count.beforeFileId, limit: GALLERY_LIMITS.images };
}
