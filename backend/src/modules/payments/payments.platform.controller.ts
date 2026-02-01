import { Controller, Param, Post, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { PlatformAdminGuard } from '../platform-admin/platform-admin.guard';
import { PaymentsService } from './payments.service';
import { buildBaseUrl } from './payments.utils';

@Controller('platform/payments/stripe')
@UseGuards(PlatformAdminGuard)
export class PaymentsPlatformController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('brand/:brandId/connect')
  connectBrand(@Param('brandId') brandId: string, @Req() req: Request) {
    const baseUrl = buildBaseUrl(req);
    return this.paymentsService.createStripeOnboardingLink('brand', brandId, baseUrl);
  }

  @Post('location/:localId/connect')
  connectLocation(@Param('localId') localId: string, @Req() req: Request) {
    const baseUrl = buildBaseUrl(req);
    return this.paymentsService.createStripeOnboardingLink('location', localId, baseUrl);
  }
}
