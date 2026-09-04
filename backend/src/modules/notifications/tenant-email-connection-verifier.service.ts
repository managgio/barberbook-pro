import { Inject, Injectable } from '@nestjs/common';
import {
  buildSmtpTransportConfig,
  requireCompleteSmtpConfig,
  SmtpConfigInput,
} from '../../contexts/engagement/domain/services/smtp-config.policy';
import {
  ENGAGEMENT_EMAIL_TRANSPORT_FACTORY_PORT,
  EngagementEmailTransportFactoryPort,
} from '../../contexts/engagement/ports/outbound/email-transport-factory.port';
import { describeEmailDeliveryError, maskEmailIdentity } from './notification-delivery-diagnostic';

export type TenantEmailConnectionVerification = {
  ok: boolean;
  code: string;
  message: string;
  endpoint?: {
    host: string;
    port: number;
    user: string;
    secure: boolean;
  };
};

@Injectable()
export class TenantEmailConnectionVerifier {
  constructor(
    @Inject(ENGAGEMENT_EMAIL_TRANSPORT_FACTORY_PORT)
    private readonly emailTransportFactory: EngagementEmailTransportFactoryPort,
  ) {}

  async verify(input?: SmtpConfigInput | null): Promise<TenantEmailConnectionVerification> {
    let config;
    try {
      config = requireCompleteSmtpConfig(input);
    } catch {
      return {
        ok: false,
        code: 'SMTP_CONFIG_INCOMPLETE',
        message: 'SMTP user, app password, host and port are required.',
      };
    }

    const transportConfig = buildSmtpTransportConfig(config);
    const endpoint = {
      host: config.host,
      port: config.port,
      user: maskEmailIdentity(config.user),
      secure: transportConfig.secure,
    };
    try {
      const transporter = this.emailTransportFactory.createTransport(transportConfig);
      await transporter.verify();
      return {
        ok: true,
        code: 'SMTP_CONNECTION_OK',
        message: 'SMTP authentication and connection succeeded.',
        endpoint,
      };
    } catch (error) {
      const diagnostic = describeEmailDeliveryError(error, config);
      return {
        ok: false,
        code: diagnostic.code,
        message: diagnostic.safeMessage,
        endpoint,
      };
    }
  }
}
