import { afterEach, expect, it, vi } from 'vitest';
import { galleryImageDimensions, galleryImageExtension, galleryImageSrcSet, galleryImageUrl, optimizeGalleryImage } from './galleryImages';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('preserves proportions, caps dimensions and never upscales small images', () => {
  expect(galleryImageDimensions(4000, 3000)).toEqual({ width: 2000, height: 1500 });
  expect(galleryImageDimensions(800, 1200)).toEqual({ width: 800, height: 1200 });
  for (const dimensions of [[0, 1000], [159, 1000], [13000, 3000], [12000, 12000], [12000, 160], [NaN, 500]]) {
    expect(() => galleryImageDimensions(...dimensions as [number, number])).toThrow();
  }
});

it('builds bounded responsive variants with automatic format and no upscaling', () => {
  const src = 'https://ik.imagekit.io/account/photo.webp';
  expect(new URL(galleryImageUrl(src, 720)).searchParams.get('tr')).toBe('w-720,c-at_max,q-85,f-auto');
  const variants = galleryImageSrcSet(src, 500);
  expect(variants).toContain('320w'); expect(variants).toContain('480w'); expect(variants).toContain('500w');
  expect(variants).not.toContain('720w');
});

it('rejects unsafe formats and oversized inputs before allocating image objects', async () => {
  await expect(optimizeGalleryImage(new File(['svg'], 'photo.svg', { type: 'image/svg+xml' }))).rejects.toThrow('GALLERY_IMAGE_FORMAT');
  const file = new File(['jpg'], 'photo.jpg', { type: 'image/jpeg' });
  vi.spyOn(file, 'size', 'get').mockReturnValue(21 * 1024 * 1024);
  await expect(optimizeGalleryImage(file)).rejects.toThrow('GALLERY_IMAGE_FORMAT');
});

it('compresses camera JPEGs when the browser cannot encode WebP instead of rejecting a large PNG fallback', async () => {
  vi.stubGlobal('Image', class { naturalWidth = 4032; naturalHeight = 3024; decode = async () => {}; });
  const revoke = vi.fn();
  vi.stubGlobal('URL', class extends URL { static createObjectURL() { return 'blob:camera'; } static revokeObjectURL = revoke; });
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as never);
  const encode = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
    const blob = new Blob(['image'], { type: type === 'image/webp' ? 'image/png' : type });
    if (type === 'image/webp') vi.spyOn(blob, 'size', 'get').mockReturnValue(6 * 1024 * 1024);
    callback(blob);
  });
  const result = await optimizeGalleryImage(new File(['camera'], 'camera.jpg', { type: 'image/jpeg' }));
  expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2000, 1500);
  expect(encode).toHaveBeenLastCalledWith(expect.any(Function), 'image/jpeg', 0.86);
  expect(result.type).toBe('image/jpeg'); expect(galleryImageExtension(result)).toBe('jpg');
  expect(revoke).toHaveBeenCalledWith('blob:camera');
});
