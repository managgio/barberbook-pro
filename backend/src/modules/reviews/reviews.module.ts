import { Module } from '@nestjs/common';
import { ENGAGEMENT_REVIEW_MANAGEMENT_PORT } from '../../contexts/engagement/ports/outbound/review-management.port';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { ReviewConfigService } from './review-config.service';
import { ReviewRequestService } from './review-request.service';
import { ReviewAnalyticsService } from './review-analytics.service';
import { ReviewsAdminController } from './reviews.admin.controller';
import { ReviewsClientController } from './reviews.client.controller';
import { PrismaReviewManagementAdapter } from './adapters/prisma-review-management.adapter';

@Module({
  imports: [PrismaModule, TenancyModule],
  providers: [
    PrismaReviewManagementAdapter,
    {
      provide: ENGAGEMENT_REVIEW_MANAGEMENT_PORT,
      useExisting: PrismaReviewManagementAdapter,
    },
    ReviewConfigService,
    ReviewRequestService,
    ReviewAnalyticsService,
  ],
  controllers: [ReviewsAdminController, ReviewsClientController],
  exports: [ReviewRequestService, ReviewConfigService],
})
export class ReviewsModule {}
