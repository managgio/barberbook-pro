import { Module } from '@nestjs/common';
import { NodemailerEmailTransportFactoryAdapter } from '../adapters/nodemailer-email-transport-factory.adapter';
import { TwilioSmsGatewayAdapter } from '../adapters/twilio-sms-gateway.adapter';
import { TwilioWhatsappGatewayAdapter } from '../adapters/twilio-whatsapp-gateway.adapter';
import { ENGAGEMENT_EMAIL_TRANSPORT_FACTORY_PORT } from '../../ports/outbound/email-transport-factory.port';
import { ENGAGEMENT_SMS_GATEWAY_PORT } from '../../ports/outbound/sms-gateway.port';
import { ENGAGEMENT_WHATSAPP_GATEWAY_PORT } from '../../ports/outbound/whatsapp-gateway.port';

@Module({
  providers: [
    {
      provide: ENGAGEMENT_EMAIL_TRANSPORT_FACTORY_PORT,
      useClass: NodemailerEmailTransportFactoryAdapter,
    },
    {
      provide: ENGAGEMENT_SMS_GATEWAY_PORT,
      useClass: TwilioSmsGatewayAdapter,
    },
    {
      provide: ENGAGEMENT_WHATSAPP_GATEWAY_PORT,
      useClass: TwilioWhatsappGatewayAdapter,
    },
  ],
  exports: [
    ENGAGEMENT_EMAIL_TRANSPORT_FACTORY_PORT,
    ENGAGEMENT_SMS_GATEWAY_PORT,
    ENGAGEMENT_WHATSAPP_GATEWAY_PORT,
  ],
})
export class EngagementNotificationGatewayModule {}
