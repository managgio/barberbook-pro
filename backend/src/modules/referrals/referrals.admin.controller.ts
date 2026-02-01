import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { ReferralConfigService } from './referral-config.service';
import { ReferralAttributionService } from './referral-attribution.service';
import { CopyReferralConfigDto } from './dto/copy-referral-config.dto';
import { ApplyReferralTemplateDto } from './dto/apply-referral-template.dto';
import { UpdateReferralConfigDto } from './dto/update-referral-config.dto';
import { VoidReferralDto } from './dto/void-referral.dto';
import { ReferralAnalyticsService } from './referral-analytics.service';
import { ReferralAttributionStatus } from '@prisma/client';
import { ReferralTemplatesService } from './referral-templates.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';

@Controller('admin/referrals')
export class ReferralsAdminController {
  constructor(
    private readonly configService: ReferralConfigService,
    private readonly attributionService: ReferralAttributionService,
    private readonly analyticsService: ReferralAnalyticsService,
    private readonly templatesService: ReferralTemplatesService,
  ) {}

  @AdminEndpoint()
  @Get('config')
  getConfig() {
    return this.configService.getConfig();
  }

  @AdminEndpoint()
  @Put('config')
  updateConfig(@Body() data: UpdateReferralConfigDto) {
    return this.configService.updateConfig(data);
  }

  @AdminEndpoint()
  @Post('config/copy-from')
  copyFrom(@Body() data: CopyReferralConfigDto) {
    return this.configService.copyFromLocation(data.sourceLocationId);
  }

  @AdminEndpoint()
  @Post('config/apply-template')
  applyTemplate(@Body() data: ApplyReferralTemplateDto) {
    return this.configService.applyTemplate(data.templateId);
  }

  @AdminEndpoint()
  @Get('templates')
  listTemplates() {
    const localId = getCurrentLocalId();
    return this.templatesService.listForLocal(localId);
  }

  @AdminEndpoint()
  @Get('overview')
  async overview(@Query('from') from?: string, @Query('to') to?: string) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    return this.analyticsService.getOverview({ from: fromDate, to: toDate });
  }

  @AdminEndpoint()
  @Get('list')
  list(
    @Query('status') status?: ReferralAttributionStatus,
    @Query('q') q?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(pageSize, 10) || 20));
    return this.attributionService.listReferrals({
      status,
      query: q,
      page: pageNumber,
      pageSize: limit,
    });
  }

  @AdminEndpoint()
  @Post('void/:id')
  voidReferral(@Param('id') id: string, @Body() data: VoidReferralDto) {
    const reason = data.reason?.trim() || 'invalidated_by_admin';
    return this.attributionService.voidAttribution(id, reason);
  }
}
