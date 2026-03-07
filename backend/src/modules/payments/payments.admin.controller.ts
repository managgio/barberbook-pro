import { Body, Controller, Get, Inject, Post, Put, Req } from '@nestjs/common';
import { Request } from 'express';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { PaymentsService } from './payments.service';
import { UpdateStripeConfigDto } from './dto/update-stripe-config.dto';
import { buildBaseUrl } from './payments.utils';

@Controller('admin/payments/stripe')
export class PaymentsAdminController {
  constructor(
    private readonly paymentsService: PaymentsService,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {}

  @Get('config')
  @AdminEndpoint()
  getConfig() {
    return this.paymentsService.getAdminStripeConfig();
  }

  @Put('config')
  @AdminEndpoint()
  updateConfig(@Body() data: UpdateStripeConfigDto) {
    if (data.enabled === undefined) {
      return this.paymentsService.getAdminStripeConfig();
    }
    return this.paymentsService.updateLocalStripeEnabled(data.enabled);
  }

  @Post('connect')
  @AdminEndpoint()
  connect(@Req() req: Request) {
    const baseUrl = buildBaseUrl(req);
    const localId = this.tenantContextPort.getRequestContext().localId;
    return this.paymentsService.createStripeOnboardingLink('location', localId, baseUrl);
  }
}
