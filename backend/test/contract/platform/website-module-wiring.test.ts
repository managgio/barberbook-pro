import 'reflect-metadata';
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import { FaqsModule } from '@/modules/faqs/faqs.module';
import { AdminFaqsController } from '@/modules/faqs/faqs.controller';
import { GalleryModule } from '@/modules/gallery/gallery.module';
import { AdminGalleryController } from '@/modules/gallery/gallery.controller';
import { LandingPublicationModule } from '@/modules/landing-publication/landing-publication.module';
import { LandingPublicationController } from '@/modules/landing-publication/landing-publication.controller';
import { LocalizationModule } from '@/modules/localization/localization.module';
import { PlatformAdminModule } from '@/modules/platform-admin/platform-admin.module';
import { PlatformAdminController } from '@/modules/platform-admin/platform-admin.controller';
import { WebsiteModule } from '@/modules/website/website.module';
import { PrismaService } from '@/prisma/prisma.service';
import { WebsiteController } from '@/modules/website/website.controller';
import { WebsiteAccessGuard } from '@/modules/website/website-access.guard';
import { WebsiteConfigStore } from '@/modules/website/website-config.store';

const consumers = [
  { module: FaqsModule, controller: AdminFaqsController },
  { module: GalleryModule, controller: AdminGalleryController },
  { module: LandingPublicationModule, controller: LandingPublicationController },
  { module: WebsiteModule, controller: WebsiteController },
  { module: PlatformAdminModule, controller: PlatformAdminController },
];

for (const consumer of consumers) {
  test(`${consumer.module.name} resolves its Website dependencies without unrelated application modules`, async () => {
    // Match the shared localization provider from bootstrap, but compile each consumer independently.
    // Other AppModule imports must not mask missing imports/exports in a feature module.
    const module = await Test.createTestingModule({ imports: [LocalizationModule, consumer.module] })
      .overrideProvider(PrismaService).useValue({}).compile();
    try {
      assert.ok(module.select(consumer.module).get(consumer.controller, { strict: true }));
      assert.ok(module.get(WebsiteAccessGuard));
      if (consumer.module === WebsiteModule || consumer.module === PlatformAdminModule) {
        assert.ok(module.get(WebsiteController));
        assert.ok(module.get(WebsiteConfigStore));
      }
    } finally { await module.close(); }
  });
}
