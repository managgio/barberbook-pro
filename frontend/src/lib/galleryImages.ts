export const GALLERY_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
export const GALLERY_IMAGE_EDGE = 2000;

export const galleryImageExtension = (blob: Blob) => blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';

export function galleryImageUrl(source: string, width: number) {
  const url = new URL(source);
  url.searchParams.set('tr', `w-${width},c-at_max,q-85,f-auto`);
  return url.toString();
}

export function galleryImageSrcSet(source: string, originalWidth: number) {
  const widths = [...new Set([320, 480, 720, 960, 1440, 2000].map((width) => Math.min(width, originalWidth)))];
  return widths.map((width) => `${galleryImageUrl(source, width)} ${width}w`).join(', ');
}

export function galleryImageDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || Math.min(width, height) < 160 ||
    Math.max(width, height) > 12000 || width * height > 50_000_000) throw new Error('GALLERY_IMAGE_DIMENSIONS');
  const scale = Math.min(1, GALLERY_IMAGE_EDGE / Math.max(width, height));
  const result = { width: Math.round(width * scale), height: Math.round(height * scale) };
  if (Math.min(result.width, result.height) < 160) throw new Error('GALLERY_IMAGE_DIMENSIONS');
  return result;
}

export async function optimizeGalleryImage(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > GALLERY_IMAGE_MAX_BYTES) {
    throw new Error('GALLERY_IMAGE_FORMAT');
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const { width, height } = galleryImageDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('GALLERY_IMAGE_FORMAT');
    context.drawImage(image, 0, 0, width, height);
    let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
    // Some mobile browsers decode WebP but encode canvas as PNG. Keep camera JPEGs compressed.
    if (blob?.type !== 'image/webp' && file.type === 'image/jpeg') {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    }
    canvas.width = 0;
    canvas.height = 0;
    if (!blob || blob.size > 4 * 1024 * 1024) throw new Error('GALLERY_IMAGE_FORMAT');
    return blob;
  } finally { URL.revokeObjectURL(objectUrl); }
}
