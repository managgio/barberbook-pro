import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WebsiteMediaPort } from '../../contexts/platform/ports/outbound/website-media.port';
import { assertWebsiteEnabled, replaceWebsiteImages, WebsiteImage, websiteImageSections } from '../../contexts/platform/domain/services/website-media.policy';
import { RequestContext } from '../../shared/application/request-context';
import { DomainError } from '../../shared/domain/domain-error';
import { PrismaService } from '../../prisma/prisma.service';
import { WebsiteConfigStore } from './website-config.store';
import { ImagekitWebsiteMediaAdapter } from './imagekit-website-media.adapter';

@Injectable()
export class PrismaWebsiteMediaAdapter implements WebsiteMediaPort {
  constructor(private readonly prisma: PrismaService, private readonly store: WebsiteConfigStore, private readonly media: ImagekitWebsiteMediaAdapter) {}
  async read(context: RequestContext) {
    const state = await this.store.read(this.prisma, context.brandId, context.localId);
    assertWebsiteEnabled(state.effective);
    return { revision: state.revision, sections: websiteImageSections(state.effective) };
  }
  resolve(context: RequestContext, fileId: string) { return this.media.resolve(context.brandId, context.localId, fileId); }
  async discard(context: RequestContext, fileId: string) {
    const image = await this.resolve(context, fileId);
    await this.store.transaction(context.brandId, async (tx) => {
      await this.store.enqueueRemoved(tx, context.brandId, { branding: { heroImageUrl: image.url, heroImageFileId: image.fileId } }, {});
    });
  }
  async save(context: RequestContext, revision: string, section: string, images: WebsiteImage[]) {
    await this.store.transaction(context.brandId, async (tx) => {
      const state = await this.store.read(tx, context.brandId, context.localId);
      if (state.revision !== revision) throw new DomainError('Images changed.', 'WEBSITE_CONFLICT');
      const next = replaceWebsiteImages(state.local, state.effective, section, images);
      await this.store.assertAvailable(tx, context.brandId, images);
      const data = next as Prisma.InputJsonValue;
      await tx.locationConfig.upsert({ where: { localId: context.localId }, create: { localId: context.localId, data }, update: { data } });
      await this.store.enqueueRemoved(tx, context.brandId, state.local, next);
    });
    return this.read(context);
  }
}
