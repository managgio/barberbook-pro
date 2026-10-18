import { Module } from '@nestjs/common';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { WEBSITE_MEDIA_PORT } from '../../contexts/platform/ports/outbound/website-media.port';
import { WebsiteAccessModule } from './website-access.guard';
import { WebsiteController } from './website.controller';
import { WebsiteConfigStore } from './website-config.store';
import { WebsiteMediaCleanup } from './website-media-cleanup';
import { ImagekitWebsiteMediaAdapter } from './imagekit-website-media.adapter';
import { PrismaWebsiteMediaAdapter } from './prisma-website-media.adapter';

@Module({
  imports: [TenancyModule, WebsiteAccessModule], controllers: [WebsiteController],
  providers: [WebsiteConfigStore, WebsiteMediaCleanup, ImagekitWebsiteMediaAdapter, { provide: WEBSITE_MEDIA_PORT, useClass: PrismaWebsiteMediaAdapter }],
  exports: [WebsiteConfigStore],
})
export class WebsiteModule {}
