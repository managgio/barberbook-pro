import { Prisma } from '@prisma/client';

export type PendingTranslationSnapshot = {
  id: string;
  brandId: string;
  localId: string | null;
  updatedAt: Date;
  content: { sourceVersion: number };
};

export const pendingTranslationWhere = (row: PendingTranslationSnapshot): Prisma.LocalizedContentTranslationWhereInput => ({
  id: row.id,
  brandId: row.brandId,
  localId: row.localId,
  status: 'pending',
  manualLocked: false,
  updatedAt: row.updatedAt,
  content: { sourceVersion: row.content.sourceVersion },
});
