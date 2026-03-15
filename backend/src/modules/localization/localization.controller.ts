import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { LocalizationService } from './localization.service';
import { QueueRegenerationDto } from './dto/queue-regeneration.dto';
import { UpsertManualTranslationDto } from './dto/upsert-manual-translation.dto';

@Controller('localization')
export class LocalizationController {
  constructor(private readonly localizationService: LocalizationService) {}

  private parseEntityIds(rawIds?: string | string[]) {
    const values = Array.isArray(rawIds) ? rawIds : [rawIds || ''];
    const entityIds = values
      .flatMap((entry) => entry.split(','))
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (entityIds.length === 0) {
      throw new BadRequestException('Debes indicar al menos un id en el query param ids.');
    }
    return entityIds;
  }

  @Get('entity/:entityType/:entityId')
  @AdminEndpoint()
  getEntityTranslations(
    @Param('entityType') entityType:
      | 'service'
      | 'service_category'
      | 'product'
      | 'product_category'
      | 'alert'
      | 'site_settings'
      | 'offer'
      | 'loyalty_program'
      | 'subscription_plan'
      | 'barber'
      | 'review_config',
    @Param('entityId') entityId: string,
  ) {
    return this.localizationService.getEntityTranslations({ entityType, entityId });
  }

  @Get('summary/:entityType')
  @AdminEndpoint()
  getEntityTranslationSummaries(
    @Param('entityType') entityType:
      | 'service'
      | 'service_category'
      | 'product'
      | 'product_category'
      | 'alert'
      | 'site_settings'
      | 'offer'
      | 'loyalty_program'
      | 'subscription_plan'
      | 'barber'
      | 'review_config',
    @Query('ids') ids?: string | string[],
  ) {
    return this.localizationService.getEntityTranslationSummaries({
      entityType,
      entityIds: this.parseEntityIds(ids),
    });
  }

  @Patch('manual')
  @AdminEndpoint()
  upsertManual(@Body() body: UpsertManualTranslationDto) {
    return this.localizationService.upsertManualTranslation(body);
  }

  @Post('regenerate')
  @AdminEndpoint()
  queueRegeneration(@Body() body: QueueRegenerationDto) {
    return this.localizationService.queueRegeneration(body);
  }
}
