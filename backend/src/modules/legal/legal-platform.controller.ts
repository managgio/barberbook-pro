import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import { LegalService } from './legal.service';
import { UpdateLegalSettingsDto } from './dto/update-legal-settings.dto';

@Controller('platform/brands/:brandId/legal')
@UseGuards(PlatformAdminGuard)
export class LegalPlatformController {
  constructor(private readonly legalService: LegalService) {}

  @Get('settings')
  getSettings(@Param('brandId') brandId: string) {
    return this.legalService.getSettings(brandId, null);
  }

  @Put('settings')
  updateSettings(
    @Param('brandId') brandId: string,
    @Body() data: UpdateLegalSettingsDto,
    @Req() req: { platformUserId?: string },
  ) {
    return this.legalService.updateSettings(brandId, data, req.platformUserId, null);
  }

  @Get('dpa')
  getDpa(@Param('brandId') brandId: string) {
    return this.legalService.getDpaContent(brandId);
  }
}
