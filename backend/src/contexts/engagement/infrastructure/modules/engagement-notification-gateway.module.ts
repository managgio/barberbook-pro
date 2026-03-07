import { Module } from '@nestjs/common';
import { NodemailerEmailTransportFactoryAdapter } from '../adapters/nodemailer-email-transport-factory.adapter';
import { TwilioClientFactoryAdapter } from '../adapters/twilio-client-factory.adapter';
import { ENGAGEMENT_EMAIL_TRANSPORT_FACTORY_PORT } from '../../ports/outbound/email-transport-factory.port';
import { ENGAGEMENT_TWILIO_CLIENT_FACTORY_PORT } from '../../ports/outbound/twilio-client-factory.port';

@Module({
  providers: [
    {
      provide: ENGAGEMENT_EMAIL_TRANSPORT_FACTORY_PORT,
      useClass: NodemailerEmailTransportFactoryAdapter,
    },
    {
      provide: ENGAGEMENT_TWILIO_CLIENT_FACTORY_PORT,
      useClass: TwilioClientFactoryAdapter,
    },
  ],
  exports: [ENGAGEMENT_EMAIL_TRANSPORT_FACTORY_PORT, ENGAGEMENT_TWILIO_CLIENT_FACTORY_PORT],
})
export class EngagementNotificationGatewayModule {}
