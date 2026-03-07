import { Injectable, Optional } from '@nestjs/common';
import * as twilio from 'twilio';
import {
  EngagementTwilioClientFactoryPort,
  EngagementTwilioClientPort,
} from '../../ports/outbound/twilio-client-factory.port';

type TwilioClientFactory = (
  accountSid: string,
  authToken: string,
) => EngagementTwilioClientPort;

@Injectable()
export class TwilioClientFactoryAdapter implements EngagementTwilioClientFactoryPort {
  constructor(
    @Optional()
    private readonly createTwilioClient?: TwilioClientFactory,
  ) {}

  private buildDefaultFactory(): TwilioClientFactory {
    return (accountSid, authToken) => twilio(accountSid, authToken);
  }

  createClient(accountSid: string, authToken: string): EngagementTwilioClientPort {
    const factory = this.createTwilioClient ?? this.buildDefaultFactory();
    return factory(accountSid, authToken);
  }
}
