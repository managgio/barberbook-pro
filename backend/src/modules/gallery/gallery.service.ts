import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ManageGalleryUseCase } from '../../contexts/engagement/application/use-cases/manage-gallery.use-case';
import { GalleryContent } from '../../contexts/engagement/domain/services/gallery-policy';
import { GALLERY_REPOSITORY_PORT, GalleryCategory, GalleryItem, GalleryRepositoryPort } from '../../contexts/engagement/ports/outbound/gallery-repository.port';
import { GALLERY_MEDIA_PORT, GalleryMediaPort } from '../../contexts/engagement/ports/outbound/gallery-media.port';
import { LANDING_PUBLICATION_PORT, LandingPublicationPort } from '../../contexts/engagement/ports/outbound/landing-publication.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { TENANT_CONFIG_READ_PORT, TenantConfigReadPort } from '../../shared/application/tenant-config-read.port';
import { rethrowDomainErrorAsHttp } from '../../shared/interfaces/http/rethrow-domain-error-as-http';
import { LocalizationService } from '../localization/localization.service';

@Injectable()
export class GalleryService {
  private readonly useCase: ManageGalleryUseCase;
  constructor(
    @Inject(GALLERY_REPOSITORY_PORT) repository: GalleryRepositoryPort,
    @Inject(TENANT_CONFIG_READ_PORT) config: TenantConfigReadPort,
    @Inject(LANDING_PUBLICATION_PORT) publication: LandingPublicationPort,
    @Inject(GALLERY_MEDIA_PORT) media: GalleryMediaPort,
    @Inject(TENANT_CONTEXT_PORT) private readonly context: TenantContextPort,
    private readonly localization: LocalizationService,
  ) { this.useCase = new ManageGalleryUseCase(repository, config, publication, media); }

  private async execute<T>(action: () => Promise<T>): Promise<T> {
    try { return await action(); } catch (error) {
      rethrowDomainErrorAsHttp(error, {
        GALLERY_DISABLED: () => new ForbiddenException('GALLERY_DISABLED'),
        GALLERY_NOT_FOUND: () => new NotFoundException('GALLERY_NOT_FOUND'),
        GALLERY_CONFLICT: () => new ConflictException('GALLERY_CONFLICT'),
        GALLERY_CATEGORY_NOT_FOUND: () => new BadRequestException('GALLERY_CATEGORY_NOT_FOUND'),
        GALLERY_CATEGORY_IN_USE: () => new BadRequestException('GALLERY_CATEGORY_IN_USE'),
        GALLERY_CATEGORY_DUPLICATE: () => new BadRequestException('GALLERY_CATEGORY_DUPLICATE'),
        GALLERY_INVALID: () => new BadRequestException('GALLERY_INVALID'),
        GALLERY_LIMIT: () => new BadRequestException('GALLERY_LIMIT'),
        GALLERY_IMAGE_LIMIT: () => new BadRequestException('GALLERY_IMAGE_LIMIT'),
        GALLERY_INVALID_MEDIA: () => new BadRequestException('GALLERY_INVALID_MEDIA'),
        GALLERY_MEDIA_UNAVAILABLE: () => new ServiceUnavailableException('GALLERY_MEDIA_UNAVAILABLE'),
      });
      throw error;
    }
  }

  list(administrative = false) {
    return this.execute(async () => {
      const context = this.context.getRequestContext();
      const collection = await this.useCase.list(context, administrative);
      if (administrative || !collection.items.length) return collection;
      const [categories, items] = await Promise.all([
        this.localization.localizeCollection({ context, entityType: 'gallery_category', items: collection.categories, syncMissingSources: false,
          descriptors: [{ fieldKey: 'name', getValue: (item: GalleryCategory) => item.name, setValue: (item: GalleryCategory, value: string) => { item.name = value; } }] }),
        this.localization.localizeCollection({ context, entityType: 'gallery_item', items: collection.items, syncMissingSources: false,
          descriptors: (['title', 'description'] as const).map((fieldKey) => ({ fieldKey, getValue: (item: GalleryItem) => item[fieldKey], setValue: (item: GalleryItem, value: string) => { item[fieldKey] = value; } })) }),
      ]);
      return { categories: categories.items, items: items.items };
    });
  }
  saveItem(identity: { id: string; version: number } | null, data: GalleryContent) {
    return this.execute(() => this.useCase.saveItem(this.context.getRequestContext(), identity, data));
  }
  removeItem(id: string, version: number) { return this.execute(() => this.useCase.removeItem(this.context.getRequestContext(), id, version)); }
  reorder(expected: string[], ordered: string[]) { return this.execute(() => this.useCase.reorder(this.context.getRequestContext(), expected, ordered)); }
  saveCategory(identity: { id: string; version: number } | null, name: string) { return this.execute(() => this.useCase.saveCategory(this.context.getRequestContext(), identity, name)); }
  removeCategory(id: string, version: number) { return this.execute(() => this.useCase.removeCategory(this.context.getRequestContext(), id, version)); }
}
