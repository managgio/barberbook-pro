import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../../auth/auth.service';
import { PaymentsService } from './payments.service';
import { CreateStripeCheckoutDto } from './dto/create-stripe-checkout.dto';
import { buildBaseUrl } from './payments.utils';

@Controller('payments/stripe')
export class PaymentsPublicController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly authService: AuthService,
  ) {}

  @Get('availability')
  getAvailability() {
    return this.paymentsService.getStripeAvailability();
  }

  @Post('checkout')
  async createCheckout(@Body() data: CreateStripeCheckoutDto, @Req() req: Request) {
    const user = await this.authService.resolveUserFromRequest(req);
    const payload: CreateStripeCheckoutDto = { ...data };
    if (user) {
      if (payload.userId && payload.userId !== user.id) {
        throw new ForbiddenException('No puedes crear pagos para otro cliente.');
      }
      payload.userId = user.id;
      payload.guestName = undefined;
      payload.guestContact = undefined;
      payload.guestEmail = undefined;
      payload.guestPhone = undefined;
      payload.reminderChannels = undefined;
    } else if (payload.userId) {
      throw new BadRequestException('No puedes asignar userId en un pago como invitado.');
    }

    const baseUrl = buildBaseUrl(req);
    return this.paymentsService.createStripeCheckoutSession(payload, baseUrl, {
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
