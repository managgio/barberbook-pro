import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { ManageReviewsUseCase } from '../../contexts/engagement/application/use-cases/manage-reviews.use-case';
import {
  ENGAGEMENT_REVIEW_MANAGEMENT_PORT,
  EngagementReviewManagementPort,
} from '../../contexts/engagement/ports/outbound/review-management.port';
import { ReviewActorDto } from './dto/review-actor.dto';
import { ReviewConfigService } from './review-config.service';
import { rethrowDomainErrorAsHttp } from '../../shared/interfaces/http/rethrow-domain-error-as-http';

@Injectable()
export class ReviewRequestService {
  private readonly manageReviewsUseCase: ManageReviewsUseCase;

  constructor(
    @Inject(ENGAGEMENT_REVIEW_MANAGEMENT_PORT)
    private readonly reviewManagementPort: EngagementReviewManagementPort,
    private readonly configService: ReviewConfigService,
  ) {
    this.manageReviewsUseCase = new ManageReviewsUseCase(this.reviewManagementPort);
  }

  handleAppointmentCompleted(appointmentId: string) {
    return this.manageReviewsUseCase.handleAppointmentCompleted(appointmentId);
  }

  async getPendingReview(actor: ReviewActorDto) {
    const pending = await this.manageReviewsUseCase.getPendingReview(actor);
    if (!pending) return null;
    const config = await this.configService.getConfig();
    return { ...pending, copy: config.copyJson };
  }

  private async execute<T>(action: () => Promise<T>): Promise<T> {
    try { return await action(); } catch (error) {
      rethrowDomainErrorAsHttp(error, {
        REVIEW_INVALID: () => new BadRequestException((error as Error).message),
        REVIEW_FINALIZED: () => new ConflictException((error as Error).message),
        REVIEW_NOT_ELIGIBLE: () => new ConflictException((error as Error).message),
      });
      throw error;
    }
  }

  markShown(id: string, actor: ReviewActorDto) {
    return this.execute(() => this.manageReviewsUseCase.markShown(id, actor));
  }

  rate(id: string, rating: number, actor: ReviewActorDto) {
    return this.execute(() => this.manageReviewsUseCase.rate(id, rating, actor));
  }

  submitFeedback(id: string, text: string, actor: ReviewActorDto) {
    return this.execute(() => this.manageReviewsUseCase.submitFeedback(id, text, actor));
  }

  markClicked(id: string, actor: ReviewActorDto) {
    return this.execute(() => this.manageReviewsUseCase.markClicked(id, actor));
  }

  snooze(id: string, actor: ReviewActorDto) {
    return this.execute(() => this.manageReviewsUseCase.snooze(id, actor));
  }
}
