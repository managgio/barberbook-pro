import { Inject, Injectable } from '@nestjs/common';
import { ManageReviewsUseCase } from '../../contexts/engagement/application/use-cases/manage-reviews.use-case';
import {
  ENGAGEMENT_REVIEW_MANAGEMENT_PORT,
  EngagementReviewConfigPayload,
  EngagementReviewCopyPayload,
  EngagementReviewManagementPort,
  EngagementUpdateReviewConfigInput,
} from '../../contexts/engagement/ports/outbound/review-management.port';
import { UpdateReviewConfigDto, ReviewCopyDto } from './dto/update-review-config.dto';

export type ReviewCopyPayload = EngagementReviewCopyPayload;
export type ReviewConfigPayload = EngagementReviewConfigPayload;

@Injectable()
export class ReviewConfigService {
  private readonly manageReviewsUseCase: ManageReviewsUseCase;

  constructor(
    @Inject(ENGAGEMENT_REVIEW_MANAGEMENT_PORT)
    private readonly reviewManagementPort: EngagementReviewManagementPort,
  ) {
    this.manageReviewsUseCase = new ManageReviewsUseCase(this.reviewManagementPort);
  }

  isModuleEnabled() {
    return this.manageReviewsUseCase.isModuleEnabled();
  }

  getConfig(): Promise<ReviewConfigPayload> {
    return this.manageReviewsUseCase.getConfig() as Promise<ReviewConfigPayload>;
  }

  getConfigRaw() {
    return this.manageReviewsUseCase.getConfigRaw();
  }

  updateConfig(data: UpdateReviewConfigDto): Promise<ReviewConfigPayload> {
    const input: EngagementUpdateReviewConfigInput = {
      ...data,
      copyJson: data.copyJson as ReviewCopyDto | undefined,
    };
    return this.manageReviewsUseCase.updateConfig(input) as Promise<ReviewConfigPayload>;
  }
}
