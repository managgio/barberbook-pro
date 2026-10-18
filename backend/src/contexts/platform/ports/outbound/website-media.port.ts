import { RequestContext } from '../../../../shared/application/request-context';
import { WebsiteImage, WebsiteImageSection } from '../../domain/services/website-media.policy';

export type WebsiteImagesSnapshot = { revision: string; sections: WebsiteImageSection[] };
export type WebsiteImageSelection = { fileId?: string; existingUrl?: string };
export const WEBSITE_MEDIA_PORT = Symbol('WEBSITE_MEDIA_PORT');
export interface WebsiteMediaPort {
  read(context: RequestContext): Promise<WebsiteImagesSnapshot>;
  resolve(context: RequestContext, fileId: string): Promise<WebsiteImage>;
  discard(context: RequestContext, fileId: string): Promise<void>;
  save(context: RequestContext, revision: string, section: string, images: WebsiteImage[]): Promise<WebsiteImagesSnapshot>;
}
