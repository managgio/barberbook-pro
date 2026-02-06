import { Body, Controller, Headers, Post } from '@nestjs/common';
import { getCurrentBrandId, getCurrentLocalId } from '../../tenancy/tenant.context';
import { ReportWebVitalDto } from './dto/report-web-vital.dto';
import { ObservabilityService } from './observability.service';

@Controller('observability')
export class ObservabilityController {
  constructor(private readonly observability: ObservabilityService) {}

  @Post('web-vitals')
  reportWebVital(
    @Body() payload: ReportWebVitalDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    this.observability.recordWebVital(payload, {
      localId: getCurrentLocalId(),
      brandId: getCurrentBrandId(),
      userAgent,
    });
    return { success: true };
  }
}
