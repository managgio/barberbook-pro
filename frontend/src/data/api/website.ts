import { apiRequest } from './request';

export type WebsiteImage = { fileId: string; url: string };
export type WebsiteImageSection = { key: string; title?: string; kind: 'hero' | 'background' | 'presentation' | 'cta'; images: WebsiteImage[]; limit: number };
export type WebsiteImagesSnapshot = { revision: string; sections: WebsiteImageSection[] };
export type WebsiteImageSelection = { fileId?: string; existingUrl?: string };
export const getWebsiteImages = (localId: string, signal?: AbortSignal): Promise<WebsiteImagesSnapshot> =>
  apiRequest('/admin/website/images', { signal, headers: { 'x-local-id': localId } });
export const replaceWebsiteImages = (localId: string, section: string, revision: string, images: WebsiteImageSelection[]): Promise<WebsiteImagesSnapshot> =>
  apiRequest(`/admin/website/images/${encodeURIComponent(section)}`, { method: 'PUT', body: { revision, images }, headers: { 'x-local-id': localId }, timeoutMs: 60_000 });
export const discardWebsiteUpload = (localId: string, fileId: string): Promise<void> =>
  apiRequest(`/admin/website/images/uploads/${encodeURIComponent(fileId)}`, { method: 'DELETE', headers: { 'x-local-id': localId } });
