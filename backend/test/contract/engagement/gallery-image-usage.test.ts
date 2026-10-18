import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { galleryImageUsage } from '@/modules/gallery/adapters/prisma-gallery-image-usage';

test('gallery capacity sums result and before images only in the resolved location', async () => {
  const db = {
    galleryItem: { aggregate: async (args: unknown) => {
      assert.deepEqual(args, { where: { localId: 'local-a1' }, _count: { _all: true, beforeFileId: true } });
      return { _count: { _all: 7, beforeFileId: 3 } };
    } },
  };
  assert.deepEqual(await galleryImageUsage(db as any, 'local-a1'), { used: 10, limit: 12 });
});
