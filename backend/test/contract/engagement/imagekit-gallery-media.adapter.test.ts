import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ImagekitGalleryMediaAdapter } from '@/modules/gallery/adapters/imagekit-gallery-media.adapter';
import { DomainError } from '@/shared/domain/domain-error';

const data = { fileId: 'file-a', fileType: 'image', filePath: '/brand/gallery/local-a/work.webp', url: 'https://ik.imagekit.io/account/brand/gallery/local-a/work.webp', width: 1200, height: 1600, size: 150000 };
const context = { localId: 'local-a', brandId: 'brand-a' } as any;
const adapter = () => new ImagekitGalleryMediaAdapter({ getEffectiveConfig: async () => ({ imagekit: { privateKey: 'test-private', urlEndpoint: 'https://ik.imagekit.io/account' } }) } as any);

test('media resolution verifies tenant path, file identity, safe endpoint, format and size', async (t) => {
  let current = data;
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(current), { status: 200 }));
  assert.deepEqual(await adapter().resolve(context, 'file-a'), { fileId: 'file-a', url: data.url, width: 1200, height: 1600 });
  current = { ...data, url: `${data.url}?updatedAt=1792353488241` };
  assert.deepEqual(await adapter().resolve(context, 'file-a'), { fileId: 'file-a', url: data.url, width: 1200, height: 1600 });
  for (const override of [{ filePath: '/brand/gallery/local-b/work.webp' }, { fileId: 'file-b' }, { url: 'https://attacker.test/work.webp' },
    { url: 'https://ik.imagekit.io/account-other/work.webp' }, { fileType: 'non-image' }, { filePath: '/brand/gallery/local-a/work.svg' },
    ...['?tr=w-50', '?updatedAt=abc', '?updatedAt=1&updatedAt=2', '?updatedAt=1&tr=w-50', '#image'].map((suffix) => ({ url: data.url + suffix })),
    { width: 5000 }, { height: 20 }, { size: 5_000_000 }, { size: 0 }, { size: NaN }]) {
    current = { ...data, ...override };
    await assert.rejects(() => adapter().resolve(context, 'file-a'), (error: unknown) => error instanceof DomainError && error.code === 'GALLERY_INVALID_MEDIA');
  }
});

test('media provider failures become safe errors without provider responses or credentials', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('sensitive-provider-response', { status: 500 }));
  await assert.rejects(() => adapter().resolve(context, 'file-a'), (error: unknown) => error instanceof DomainError && error.code === 'GALLERY_MEDIA_UNAVAILABLE' && !error.message.includes('sensitive'));
});

test('malformed provider payloads are reported as safe media failures', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('not-json', { status: 200 }));
  await assert.rejects(() => adapter().resolve(context, 'file-a'), (error: unknown) => error instanceof DomainError && error.code === 'GALLERY_MEDIA_UNAVAILABLE');
});
