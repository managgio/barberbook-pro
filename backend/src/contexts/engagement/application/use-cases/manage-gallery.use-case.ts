import { RequestContext } from '../../../../shared/application/request-context';
import { TenantConfigReadPort } from '../../../../shared/application/tenant-config-read.port';
import { DomainError } from '../../../../shared/domain/domain-error';
import { GalleryContent, normalizeGalleryContent, normalizeGalleryName } from '../../domain/services/gallery-policy';
import { GalleryRepositoryPort } from '../../ports/outbound/gallery-repository.port';
import { GalleryMediaPort } from '../../ports/outbound/gallery-media.port';
import { LandingPublicationPort } from '../../ports/outbound/landing-publication.port';

export class ManageGalleryUseCase {
  constructor(private readonly repository: GalleryRepositoryPort, private readonly config: TenantConfigReadPort,
    private readonly publication: LandingPublicationPort, private readonly media: GalleryMediaPort) {}

  private async enabled() { return (await this.config.getEffectiveConfig()).features?.galleryEnabled === true; }
  private async assertEnabled() {
    if (!(await this.enabled())) throw new DomainError('Gallery is disabled.', 'GALLERY_DISABLED');
  }

  async list(context: RequestContext, administrative = false) {
    if (!(await this.enabled())) {
      if (administrative) throw new DomainError('Gallery is disabled.', 'GALLERY_DISABLED');
      return { categories: [], items: [] };
    }
    if (!administrative && !(await this.publication.get(context, 'gallery')).published) return { categories: [], items: [] };
    if (administrative) {
      const [collection, imageUsage] = await Promise.all([this.repository.list(context), this.repository.imageUsage(context)]);
      return { ...collection, imageUsage };
    }
    return this.repository.list(context);
  }

  async saveItem(context: RequestContext, identity: { id: string; version: number } | null, input: GalleryContent) {
    await this.assertEnabled();
    const content = normalizeGalleryContent(input);
    // Provider verification happens before the short database transaction.
    const [image, before] = await Promise.all([
      this.media.resolve(context, content.imageFileId),
      content.beforeFileId ? this.media.resolve(context, content.beforeFileId) : Promise.resolve(null),
    ]);
    return this.repository.saveItem(context, identity, { ...content, image, before });
  }

  async removeItem(context: RequestContext, id: string, version: number) {
    await this.assertEnabled();
    return this.repository.removeItem(context, id, version);
  }
  async reorder(context: RequestContext, expected: string[], ordered: string[]) {
    await this.assertEnabled();
    return this.repository.reorder(context, expected, ordered);
  }
  async saveCategory(context: RequestContext, identity: { id: string; version: number } | null, name: string) {
    await this.assertEnabled();
    return this.repository.saveCategory(context, identity, normalizeGalleryName(name));
  }
  async removeCategory(context: RequestContext, id: string, version: number) {
    await this.assertEnabled();
    return this.repository.removeCategory(context, id, version);
  }
}
