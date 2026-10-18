import { WebsiteAccessModule } from '../website/website-access.guard';
import { Module } from '@nestjs/common';
import { LANDING_PUBLICATION_PORT } from '../../contexts/engagement/ports/outbound/landing-publication.port';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { LandingPublicationController } from './landing-publication.controller';
import { PrismaLandingPublicationAdapter } from './prisma-landing-publication.adapter';

@Module({
  imports: [WebsiteAccessModule, TenancyModule], controllers: [LandingPublicationController],
  providers: [{ provide: LANDING_PUBLICATION_PORT, useClass: PrismaLandingPublicationAdapter }],
  exports: [LANDING_PUBLICATION_PORT],
})
export class LandingPublicationModule {}
