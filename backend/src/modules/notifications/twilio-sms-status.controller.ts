import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Post,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TwilioSmsStatusWebhookAdapter } from '../../contexts/engagement/infrastructure/adapters/twilio-sms-status-webhook.adapter';

const isDeliveryReference = (value: string) => /^[a-zA-Z0-9_-]{8,80}$/.test(value);

@Controller('notifications/webhooks/twilio')
export class TwilioSmsStatusController {
  constructor(private readonly webhook: TwilioSmsStatusWebhookAdapter) {}

  @Post('sms-status')
  @HttpCode(204)
  async recordSmsStatus(
    @Query('deliveryId') deliveryReference?: string,
    @Headers('x-twilio-signature') signature?: string,
    @Body() body: Record<string, unknown> = {},
  ) {
    if (!deliveryReference || !isDeliveryReference(deliveryReference)) {
      throw new BadRequestException('Invalid delivery reference.');
    }
    const result = await this.webhook.handle({
      deliveryReference,
      signature: signature || '',
      body,
    });
    if (result.outcome === 'not_configured') {
      throw new ServiceUnavailableException('SMS delivery callbacks are not configured.');
    }
    if (result.outcome === 'invalid_signature') {
      throw new ForbiddenException('Invalid provider signature.');
    }
    if (result.outcome === 'invalid_payload') {
      throw new BadRequestException('Invalid provider payload.');
    }
  }
}
