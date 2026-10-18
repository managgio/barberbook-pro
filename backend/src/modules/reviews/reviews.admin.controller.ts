import { Body, Controller, Get, Inject, Param, Post, Put, Query } from '@nestjs/common';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { ReviewConfigService } from './review-config.service';
import { ReviewAnalyticsService } from './review-analytics.service';
import { UpdateReviewConfigDto } from './dto/update-review-config.dto';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { parseReviewMetricsRange, ReviewFeedbackQueryDto } from './dto/review-query.dto';

@Controller('admin/reviews')
export class ReviewsAdminController {
  constructor(
    private readonly configService: ReviewConfigService,
    private readonly analyticsService: ReviewAnalyticsService,
    @Inject(TENANT_CONTEXT_PORT) private readonly context: TenantContextPort,
  ) {}

  @AdminEndpoint()
  @Get('config')
  getConfig() {
    return this.configService.getConfig(false);
  }

  @AdminEndpoint()
  @Put('config')
  updateConfig(@Body() data: UpdateReviewConfigDto) {
    return this.configService.updateConfig(data);
  }

  @AdminEndpoint()
  @Get('metrics')
  getMetrics(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getMetrics(parseReviewMetricsRange(from, to, this.context.getRequestContext().timezone));
  }

  @AdminEndpoint()
  @Get('feedback')
  listFeedback(@Query() query: ReviewFeedbackQueryDto) {
    return this.analyticsService.listFeedback(query);
  }

  @AdminEndpoint()
  @Post('feedback/:id/resolve')
  resolveFeedback(@Param('id') id: string) {
    return this.analyticsService.resolveFeedback(id);
  }
}
