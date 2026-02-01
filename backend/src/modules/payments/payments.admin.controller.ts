import { Body, Controller, Get, Post, Put, Req } from '@nestjs/common';
import { Request } from 'express';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { PaymentsService } from './payments.service';
import { UpdateStripeConfigDto } from './dto/update-stripe-config.dto';
import { buildBaseUrl } from './payments.utils';
import { getCurrentLocalId } from '../../tenancy/tenant.context';

@Controller('admin/payments/stripe')
export class PaymentsAdminController {
  constructor(private readonly paymentsService: PaymentsService) {}

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
    return this.paymentsService.createStripeOnboardingLink('location', getCurrentLocalId(), baseUrl);
  }
}
