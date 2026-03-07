import { Inject, Injectable } from '@nestjs/common';
import { ManageReviewsUseCase } from '../../contexts/engagement/application/use-cases/manage-reviews.use-case';
import {
  ENGAGEMENT_REVIEW_MANAGEMENT_PORT,
  EngagementReviewManagementPort,
} from '../../contexts/engagement/ports/outbound/review-management.port';
import { ReviewActorDto } from './dto/review-actor.dto';

@Injectable()
export class ReviewRequestService {
  private readonly manageReviewsUseCase: ManageReviewsUseCase;

  constructor(
    @Inject(ENGAGEMENT_REVIEW_MANAGEMENT_PORT)
    private readonly reviewManagementPort: EngagementReviewManagementPort,
  ) {
    this.manageReviewsUseCase = new ManageReviewsUseCase(this.reviewManagementPort);
  }

  handleAppointmentCompleted(appointmentId: string) {
    return this.manageReviewsUseCase.handleAppointmentCompleted(appointmentId);
  }

  getPendingReview(actor: ReviewActorDto) {
    return this.manageReviewsUseCase.getPendingReview(actor);
  }

  markShown(id: string, actor: ReviewActorDto) {
    return this.manageReviewsUseCase.markShown(id, actor);
  }

  rate(id: string, rating: number, actor: ReviewActorDto) {
    return this.manageReviewsUseCase.rate(id, rating, actor);
  }

  submitFeedback(id: string, text: string, actor: ReviewActorDto) {
    return this.manageReviewsUseCase.submitFeedback(id, text, actor);
  }

  markClicked(id: string, actor: ReviewActorDto) {
    return this.manageReviewsUseCase.markClicked(id, actor);
  }

  snooze(id: string, actor: ReviewActorDto) {
    return this.manageReviewsUseCase.snooze(id, actor);
  }
}
