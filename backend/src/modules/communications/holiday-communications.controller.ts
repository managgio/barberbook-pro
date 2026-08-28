import { Body, Controller, Post, Req } from '@nestjs/common';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { CommunicationsService } from './communications.service';
import { HolidayClosureActionDto } from './dto/holiday-closure-action.dto';

@Controller('holidays')
export class HolidayCommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Post('notify-and-cancel')
  @AdminEndpoint()
  notifyAndCancel(
    @Body() dto: HolidayClosureActionDto,
    @Req() req: { adminUserId?: string },
  ) {
    return this.communicationsService.createHolidayClosure(
      dto,
      req.adminUserId || null,
    );
  }
}
