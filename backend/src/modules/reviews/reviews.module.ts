import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { ReviewConfigService } from './review-config.service';
import { ReviewRequestService } from './review-request.service';
import { ReviewAnalyticsService } from './review-analytics.service';
import { ReviewsAdminController } from './reviews.admin.controller';
import { ReviewsClientController } from './reviews.client.controller';

@Module({
  imports: [PrismaModule, TenancyModule],
  providers: [ReviewConfigService, ReviewRequestService, ReviewAnalyticsService],
  controllers: [ReviewsAdminController, ReviewsClientController],
  exports: [ReviewRequestService, ReviewConfigService],
})
export class ReviewsModule {}
