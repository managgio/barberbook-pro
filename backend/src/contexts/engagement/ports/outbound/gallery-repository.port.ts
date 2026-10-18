import { RequestContext } from '../../../../shared/application/request-context';
import { GalleryContent, GalleryImageUsage, GalleryMedia } from '../../domain/services/gallery-policy';

export const GALLERY_REPOSITORY_PORT = Symbol('GALLERY_REPOSITORY_PORT');
export type GalleryCategory = { id: string; name: string; version: number };
export type GalleryItem = GalleryContent & {
  id: string; version: number; position: number; imageUrl: string; imageWidth: number; imageHeight: number;
  beforeUrl: string | null; beforeWidth: number | null; beforeHeight: number | null;
};
export type GalleryCollection = { categories: GalleryCategory[]; items: GalleryItem[] };
export type GalleryWrite = GalleryContent & { image: GalleryMedia; before: GalleryMedia | null };
export interface GalleryRepositoryPort {
  list(context: RequestContext): Promise<GalleryCollection>;
  imageUsage(context: RequestContext): Promise<GalleryImageUsage>;
  saveItem(context: RequestContext, identity: { id: string; version: number } | null, content: GalleryWrite): Promise<GalleryItem>;
  removeItem(context: RequestContext, id: string, version: number): Promise<void>;
  reorder(context: RequestContext, expected: string[], ordered: string[]): Promise<GalleryItem[]>;
  saveCategory(context: RequestContext, identity: { id: string; version: number } | null, name: string): Promise<GalleryCategory>;
  removeCategory(context: RequestContext, id: string, version: number): Promise<void>;
}
