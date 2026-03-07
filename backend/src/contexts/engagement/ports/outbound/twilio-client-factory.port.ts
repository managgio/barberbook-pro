export const ENGAGEMENT_TWILIO_CLIENT_FACTORY_PORT = Symbol(
  'ENGAGEMENT_TWILIO_CLIENT_FACTORY_PORT',
);

export type EngagementTwilioMessagePayload = {
  to: string;
  body?: string;
  from?: string;
  messagingServiceSid?: string;
  contentSid?: string;
  contentVariables?: string;
};

export type EngagementTwilioMessageResult = {
  sid: string;
  price: string | null;
  priceUnit: string | null;
};

export interface EngagementTwilioClientPort {
  messages: {
    create(payload: EngagementTwilioMessagePayload): Promise<EngagementTwilioMessageResult>;
  };
}

export interface EngagementTwilioClientFactoryPort {
  createClient(accountSid: string, authToken: string): EngagementTwilioClientPort;
}
