export const ENGAGEMENT_EMAIL_TRANSPORT_FACTORY_PORT = Symbol(
  'ENGAGEMENT_EMAIL_TRANSPORT_FACTORY_PORT',
);

export type EngagementEmailTransportConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
};

export type EngagementEmailAttachment = {
  filename: string;
  path: string;
  cid?: string;
};

export type EngagementSendEmailPayload = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EngagementEmailAttachment[];
};

export interface EngagementEmailTransportPort {
  sendMail(payload: EngagementSendEmailPayload): Promise<unknown>;
}

export interface EngagementEmailTransportFactoryPort {
  createTransport(config: EngagementEmailTransportConfig): EngagementEmailTransportPort;
}
