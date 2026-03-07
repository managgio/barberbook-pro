import { Body, Controller, Headers, Inject, Post } from '@nestjs/common';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { ReportWebVitalDto } from './dto/report-web-vital.dto';
import { ObservabilityService } from './observability.service';

@Controller('observability')
export class ObservabilityController {
  constructor(
    private readonly observability: ObservabilityService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  @Post('web-vitals')
  reportWebVital(
    @Body() payload: ReportWebVitalDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    const tenantContext = this.tenantContextPort.getRequestContext();
    this.observability.recordWebVital(payload, {
      localId: tenantContext.localId,
      brandId: tenantContext.brandId,
      userAgent,
    });
    return { success: true };
  }
}
