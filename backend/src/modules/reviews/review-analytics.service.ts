import { Inject, Injectable } from '@nestjs/common';
import { ReviewFeedbackStatus } from '@prisma/client';
import { ManageReviewsUseCase } from '../../contexts/engagement/application/use-cases/manage-reviews.use-case';
import {
  ENGAGEMENT_REVIEW_MANAGEMENT_PORT,
  EngagementReviewManagementPort,
} from '../../contexts/engagement/ports/outbound/review-management.port';

@Injectable()
export class ReviewAnalyticsService {
  private readonly manageReviewsUseCase: ManageReviewsUseCase;

  constructor(
    @Inject(ENGAGEMENT_REVIEW_MANAGEMENT_PORT)
    private readonly reviewManagementPort: EngagementReviewManagementPort,
  ) {
    this.manageReviewsUseCase = new ManageReviewsUseCase(this.reviewManagementPort);
  }

  getMetrics(params?: { from?: Date; to?: Date }) {
    return this.manageReviewsUseCase.getMetrics(params);
  }

  listFeedback(params: { status?: ReviewFeedbackStatus; page: number; pageSize: number }) {
    return this.manageReviewsUseCase.listFeedback(params);
  }

  resolveFeedback(id: string) {
    return this.manageReviewsUseCase.resolveFeedback(id);
  }
}
