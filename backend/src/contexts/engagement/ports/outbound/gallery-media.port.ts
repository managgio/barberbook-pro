import { RequestContext } from '../../../../shared/application/request-context';
import { GalleryMedia } from '../../domain/services/gallery-policy';

export const GALLERY_MEDIA_PORT = Symbol('GALLERY_MEDIA_PORT');
export interface GalleryMediaPort {
  resolve(context: RequestContext, fileId: string): Promise<GalleryMedia>;
}
