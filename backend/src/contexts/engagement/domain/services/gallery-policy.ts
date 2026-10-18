import { DomainError } from '../../../../shared/domain/domain-error';

export const GALLERY_LIMITS = { images: 12, items: 100, categories: 24, title: 120, description: 2000, category: 80 } as const;
export type GalleryContent = { title: string; description: string; categoryId: string; imageFileId: string; beforeFileId: string | null };
export type GalleryMedia = { fileId: string; url: string; width: number; height: number };
export type GalleryImageUsage = { used: number; limit: number };

export function assertGalleryImageCapacity(used: number, previous: number, next: number) {
  // Existing collections above the limit can be maintained or reduced, never expanded.
  if (used - previous + next > Math.max(GALLERY_LIMITS.images, used)) {
    throw new DomainError('Gallery image limit reached.', 'GALLERY_IMAGE_LIMIT');
  }
}

export function normalizeGalleryName(value: string) {
  const name = value.trim();
  if (!name || name.length > GALLERY_LIMITS.category) throw new DomainError('Invalid category.', 'GALLERY_INVALID');
  return name;
}

export function normalizeGalleryContent(content: GalleryContent): GalleryContent {
  const title = content.title.trim();
  const description = content.description.trim();
  if (!title || title.length > GALLERY_LIMITS.title || description.length > GALLERY_LIMITS.description || !content.categoryId ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(content.imageFileId) ||
    (content.beforeFileId !== null && !/^[a-zA-Z0-9_-]{1,128}$/.test(content.beforeFileId)) || content.imageFileId === content.beforeFileId) {
    throw new DomainError('Invalid gallery content.', 'GALLERY_INVALID');
  }
  return { title, description, categoryId: content.categoryId, imageFileId: content.imageFileId, beforeFileId: content.beforeFileId };
}

export function assertGalleryOrder(current: string[], expected: string[], ordered: string[]) {
  if (current.length !== expected.length || current.some((id, index) => id !== expected[index])) {
    throw new DomainError('Gallery has changed.', 'GALLERY_CONFLICT');
  }
  const valid = new Set(current);
  if (ordered.length !== current.length || new Set(ordered).size !== current.length || ordered.some((id) => !valid.has(id))) {
    throw new DomainError('Invalid gallery order.', 'GALLERY_INVALID');
  }
}
