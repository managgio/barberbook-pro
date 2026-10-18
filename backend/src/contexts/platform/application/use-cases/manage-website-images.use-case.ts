import { RequestContext } from '../../../../shared/application/request-context';
import { DomainError } from '../../../../shared/domain/domain-error';
import { WebsiteImageSelection, WebsiteMediaPort } from '../../ports/outbound/website-media.port';

export class ManageWebsiteImagesUseCase {
  constructor(private readonly media: WebsiteMediaPort) {}
  read(context: RequestContext) { return this.media.read(context); }
  async discard(context: RequestContext, fileId: string) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(fileId)) throw new DomainError('Invalid image.', 'WEBSITE_INVALID');
    await this.media.discard(context, fileId);
  }
  async replace(context: RequestContext, revision: string, section: string, selection: WebsiteImageSelection[]) {
    const current = await this.media.read(context);
    if (current.revision !== revision) throw new DomainError('Images changed.', 'WEBSITE_CONFLICT');
    const target = current.sections.find((entry) => entry.key === section);
    if (!target) throw new DomainError('Section unavailable.', 'WEBSITE_SECTION_DISABLED');
    if (selection.length > target.limit) throw new DomainError('Invalid images.', 'WEBSITE_INVALID');
    const images = await Promise.all(selection.map(async (entry) => {
      // Existing external images can be retained, but a client can never introduce an arbitrary URL.
      const existing = target.images.find((item) => entry.fileId ? item.fileId === entry.fileId : item.url === entry.existingUrl);
      if (existing) return existing;
      if (!entry.fileId || entry.existingUrl) throw new DomainError('Invalid image.', 'WEBSITE_INVALID');
      return this.media.resolve(context, entry.fileId);
    }));
    return this.media.save(context, revision, section, images);
  }
}
