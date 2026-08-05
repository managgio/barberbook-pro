import { Body, Controller, Headers, Inject, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../../auth/auth.service';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { ReportWebVitalDto } from './dto/report-web-vital.dto';
import { ReportCriticalTraceDto } from './dto/report-critical-trace.dto';
import { ObservabilityService } from './observability.service';

@Controller('observability')
export class ObservabilityController {
  constructor(
    private readonly observability: ObservabilityService,
    private readonly authService: AuthService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  @Post('web-vitals')
  reportWebVital(
    @Body() payload: ReportWebVitalDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    const tenantContext = this.tenantContextPort.getRequestContext();
    if (!tenantContext?.localId || !tenantContext?.brandId) {
      return { success: true };
    }
    this.observability.recordWebVital(payload, {
      localId: tenantContext.localId,
      brandId: tenantContext.brandId,
      userAgent,
    });
    return { success: true };
  }

  @Post('critical-traces')
  async reportCriticalTrace(
    @Body() payload: ReportCriticalTraceDto,
    @Req() request: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    const tenantContext = this.tenantContextPort.getRequestContext();
    if (!tenantContext?.localId || !tenantContext?.brandId) return { success: true };
    let user = null;
    try {
      const actor = await this.authService.resolveUserFromRequest(request);
      user = actor ? { id: actor.id, name: actor.name, email: actor.email } : null;
    } catch {
      // La traza debe seguir disponible para invitados o sesiones que expiran durante la reserva.
    }
    await this.observability.recordCriticalTrace(payload, {
      brandId: tenantContext.brandId,
      localId: tenantContext.localId,
      subdomain: tenantContext.subdomain,
      userAgent,
      user,
    });
    return { success: true };
  }
}
