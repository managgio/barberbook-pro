import { WebsiteAccessModule } from '../website/website-access.guard';
import { LandingPublicationModule } from '../landing-publication/landing-publication.module';
import { Module } from '@nestjs/common';
import { FAQ_REPOSITORY_PORT } from '../../contexts/engagement/ports/outbound/faq-repository.port';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { PrismaFaqRepositoryAdapter } from './adapters/prisma-faq-repository.adapter';
import { AdminFaqsController, FaqsController } from './faqs.controller';
import { FaqsService } from './faqs.service';

@Module({
  imports: [WebsiteAccessModule, TenancyModule, LandingPublicationModule],
  controllers: [FaqsController, AdminFaqsController],
  providers: [FaqsService, { provide: FAQ_REPOSITORY_PORT, useClass: PrismaFaqRepositoryAdapter }],
})
export class FaqsModule {}
