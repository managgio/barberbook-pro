import { Body, Controller, Get, Headers, Param, Post, Req, RawBodyRequest, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CreateStripeCheckoutDto } from './dto/create-stripe-checkout.dto';
import { buildBaseUrl } from './payments.utils';

@Controller('payments/stripe')
export class PaymentsPublicController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('availability')
  getAvailability() {
    return this.paymentsService.getStripeAvailability();
  }

  @Post('checkout')
  createCheckout(@Body() data: CreateStripeCheckoutDto, @Req() req: Request) {
    const baseUrl = buildBaseUrl(req);
    return this.paymentsService.createStripeCheckoutSession(data, baseUrl, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('session/:id')
  getSession(@Param('id') id: string) {
    return this.paymentsService.fetchStripeSession(id);
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    const rawBody = (req as RawBodyRequest<Request>).rawBody
      || (Buffer.isBuffer(req.body) ? (req.body as Buffer) : null);
    if (!rawBody) {
      throw new BadRequestException('Raw body no disponible para Stripe.');
    }
    return this.paymentsService.handleStripeWebhook(rawBody, signature);
  }
}
