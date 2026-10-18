import { apiRequest } from './request';

export const GALLERY_LIMITS = { items: 100, categories: 24, title: 120, description: 2000, category: 80 } as const;
export type GalleryCategory = { id: string; name: string; version: number };
export type GalleryImageUsage = { used: number; limit: number };
export type GalleryContent = { title: string; description: string; categoryId: string; imageFileId: string; beforeFileId: string | null };
export type GalleryItem = GalleryContent & {
  id: string; version: number; position: number; imageUrl: string; imageWidth: number; imageHeight: number;
  beforeUrl: string | null; beforeWidth: number | null; beforeHeight: number | null;
};
export type GalleryCollection = { categories: GalleryCategory[]; items: GalleryItem[]; imageUsage?: GalleryImageUsage };
export const getGallery = (administrative = false, signal?: AbortSignal) =>
  apiRequest<GalleryCollection>(administrative ? '/admin/gallery' : '/gallery', { signal });
export const saveGalleryItem = (item: GalleryItem | null, content: GalleryContent) =>
  apiRequest<GalleryItem>(item ? `/admin/gallery/items/${item.id}` : '/admin/gallery/items', {
    method: item ? 'PATCH' : 'POST', body: { ...content, ...(item ? { version: item.version } : {}) },
  });
export const deleteGalleryItem = (item: GalleryItem) =>
  apiRequest<void>(`/admin/gallery/items/${item.id}`, { method: 'DELETE', body: { version: item.version } });
export const reorderGallery = (expectedIds: string[], orderedIds: string[]) =>
  apiRequest<GalleryItem[]>('/admin/gallery/items/order', { method: 'PATCH', body: { expectedIds, orderedIds } });
export const saveGalleryCategory = (category: GalleryCategory | null, name: string) =>
  apiRequest<GalleryCategory>(category ? `/admin/gallery/categories/${category.id}` : '/admin/gallery/categories', {
    method: category ? 'PATCH' : 'POST', body: { name, ...(category ? { version: category.version } : {}) },
  });
export const deleteGalleryCategory = (category: GalleryCategory) =>
  apiRequest<void>(`/admin/gallery/categories/${category.id}`, { method: 'DELETE', body: { version: category.version } });
