import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { ReviewConfigService } from './review-config.service';
import { ReviewAnalyticsService } from './review-analytics.service';
import { UpdateReviewConfigDto } from './dto/update-review-config.dto';
import { ReviewFeedbackStatus } from '@prisma/client';

@Controller('admin/reviews')
export class ReviewsAdminController {
  constructor(
    private readonly configService: ReviewConfigService,
    private readonly analyticsService: ReviewAnalyticsService,
  ) {}

  @AdminEndpoint()
  @Get('config')
  getConfig() {
    return this.configService.getConfig();
  }

  @AdminEndpoint()
  @Put('config')
  updateConfig(@Body() data: UpdateReviewConfigDto) {
    return this.configService.updateConfig(data);
  }

  @AdminEndpoint()
  @Get('metrics')
  getMetrics(@Query('from') from?: string, @Query('to') to?: string) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    return this.analyticsService.getMetrics({ from: fromDate, to: toDate });
  }

  @AdminEndpoint()
  @Get('feedback')
  listFeedback(
    @Query('status') status?: ReviewFeedbackStatus,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(pageSize, 10) || 20));
    return this.analyticsService.listFeedback({
      status,
      page: pageNumber,
      pageSize: limit,
    });
  }

  @AdminEndpoint()
  @Post('feedback/:id/resolve')
  resolveFeedback(@Param('id') id: string) {
    return this.analyticsService.resolveFeedback(id);
  }
}
