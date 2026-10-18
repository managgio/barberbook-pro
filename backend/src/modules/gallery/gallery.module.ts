import { WebsiteAccessModule } from '../website/website-access.guard';
import { Module } from '@nestjs/common';
import { GALLERY_REPOSITORY_PORT } from '../../contexts/engagement/ports/outbound/gallery-repository.port';
import { GALLERY_MEDIA_PORT } from '../../contexts/engagement/ports/outbound/gallery-media.port';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { LandingPublicationModule } from '../landing-publication/landing-publication.module';
import { ImagekitGalleryMediaAdapter } from './adapters/imagekit-gallery-media.adapter';
import { PrismaGalleryRepositoryAdapter } from './adapters/prisma-gallery-repository.adapter';
import { AdminGalleryController, GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';

@Module({
  imports: [WebsiteAccessModule, TenancyModule, LandingPublicationModule], controllers: [GalleryController, AdminGalleryController],
  providers: [GalleryService, { provide: GALLERY_REPOSITORY_PORT, useClass: PrismaGalleryRepositoryAdapter }, { provide: GALLERY_MEDIA_PORT, useClass: ImagekitGalleryMediaAdapter }],
})
export class GalleryModule {}
