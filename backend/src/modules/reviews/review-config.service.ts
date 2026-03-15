import { Inject, Injectable } from '@nestjs/common';
import { ManageReviewsUseCase } from '../../contexts/engagement/application/use-cases/manage-reviews.use-case';
import {
  ENGAGEMENT_REVIEW_MANAGEMENT_PORT,
  EngagementReviewConfigPayload,
  EngagementReviewCopyPayload,
  EngagementReviewManagementPort,
  EngagementUpdateReviewConfigInput,
} from '../../contexts/engagement/ports/outbound/review-management.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { LocalizationService } from '../localization/localization.service';
import { UpdateReviewConfigDto, ReviewCopyDto } from './dto/update-review-config.dto';

export type ReviewCopyPayload = EngagementReviewCopyPayload;
export type ReviewConfigPayload = EngagementReviewConfigPayload;

@Injectable()
export class ReviewConfigService {
  private readonly manageReviewsUseCase: ManageReviewsUseCase;

  constructor(
    @Inject(ENGAGEMENT_REVIEW_MANAGEMENT_PORT)
    private readonly reviewManagementPort: EngagementReviewManagementPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
    private readonly localizationService: LocalizationService,
  ) {
    this.manageReviewsUseCase = new ManageReviewsUseCase(this.reviewManagementPort);
  }

  isModuleEnabled() {
    return this.manageReviewsUseCase.isModuleEnabled();
  }

  private async localizeConfig(config: ReviewConfigPayload): Promise<ReviewConfigPayload> {
    const context = this.tenantContextPort.getRequestContext();
    type LocalizableReviewConfig = Omit<ReviewConfigPayload, 'id'> & { id: string };
    const { id: _configId, ...rest } = config;
    const localizable: LocalizableReviewConfig = {
      ...rest,
      id: config.localId,
    };
    const { items } = await this.localizationService.localizeCollection<LocalizableReviewConfig>({
      context,
      entityType: 'review_config',
      items: [localizable],
      descriptors: [
        {
          fieldKey: 'copyJson.title',
          getValue: (item) => item.copyJson.title,
          setValue: (item, value) => {
            item.copyJson.title = value;
          },
        },
        {
          fieldKey: 'copyJson.subtitle',
          getValue: (item) => item.copyJson.subtitle,
          setValue: (item, value) => {
            item.copyJson.subtitle = value;
          },
        },
        {
          fieldKey: 'copyJson.positiveText',
          getValue: (item) => item.copyJson.positiveText,
          setValue: (item, value) => {
            item.copyJson.positiveText = value;
          },
        },
        {
          fieldKey: 'copyJson.positiveCta',
          getValue: (item) => item.copyJson.positiveCta,
          setValue: (item, value) => {
            item.copyJson.positiveCta = value;
          },
        },
        {
          fieldKey: 'copyJson.negativeText',
          getValue: (item) => item.copyJson.negativeText,
          setValue: (item, value) => {
            item.copyJson.negativeText = value;
          },
        },
        {
          fieldKey: 'copyJson.negativeCta',
          getValue: (item) => item.copyJson.negativeCta,
          setValue: (item, value) => {
            item.copyJson.negativeCta = value;
          },
        },
        {
          fieldKey: 'copyJson.snoozeCta',
          getValue: (item) => item.copyJson.snoozeCta,
          setValue: (item, value) => {
            item.copyJson.snoozeCta = value;
          },
        },
      ],
    });
    const localized = items[0];
    return {
      id: config.id,
      localId: localized.localId,
      enabled: localized.enabled,
      googleReviewUrl: localized.googleReviewUrl,
      cooldownDays: localized.cooldownDays,
      minVisitsToAsk: localized.minVisitsToAsk,
      showDelayMinutes: localized.showDelayMinutes,
      maxSnoozes: localized.maxSnoozes,
      snoozeHours: localized.snoozeHours,
      copyJson: localized.copyJson,
    };
  }

  async getConfig(): Promise<ReviewConfigPayload> {
    const config = (await this.manageReviewsUseCase.getConfig()) as ReviewConfigPayload;
    return this.localizeConfig(config);
  }

  getConfigRaw() {
    return this.manageReviewsUseCase.getConfigRaw();
  }

  async updateConfig(data: UpdateReviewConfigDto): Promise<ReviewConfigPayload> {
    const input: EngagementUpdateReviewConfigInput = {
      ...data,
      copyJson: data.copyJson as ReviewCopyDto | undefined,
    };
    const updated = (await this.manageReviewsUseCase.updateConfig(input)) as ReviewConfigPayload;
    const context = this.tenantContextPort.getRequestContext();
    await this.localizationService.syncEntitySourceFields({
      context,
      entityType: 'review_config',
      entityId: updated.localId,
      fields: {
        'copyJson.title': updated.copyJson.title,
        'copyJson.subtitle': updated.copyJson.subtitle,
        'copyJson.positiveText': updated.copyJson.positiveText,
        'copyJson.positiveCta': updated.copyJson.positiveCta,
        'copyJson.negativeText': updated.copyJson.negativeText,
        'copyJson.negativeCta': updated.copyJson.negativeCta,
        'copyJson.snoozeCta': updated.copyJson.snoozeCta,
      },
    });
    return this.localizeConfig(updated);
  }
}
