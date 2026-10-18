import { Injectable, Optional } from '@nestjs/common';
import * as twilio from 'twilio';
import { normalizeSmsRecipient } from '../../domain/services/sms-recipient.policy';
import {
  EngagementWhatsappGatewayPort,
  EngagementWhatsappGatewayResult,
  EngagementWhatsappSendCommand,
  EngagementWhatsappTemplateData,
} from '../../ports/outbound/whatsapp-gateway.port';

type TwilioWhatsappPayload = {
  to: string;
  from: string;
  body?: string;
  contentSid?: string;
  contentVariables?: string;
};

type TwilioWhatsappResult = {
  sid: string;
  price: string | null;
  priceUnit: string | null;
};

type TwilioWhatsappClient = {
  messages: {
    create(payload: TwilioWhatsappPayload): Promise<TwilioWhatsappResult>;
  };
};

type TwilioWhatsappClientFactory = (accountSid: string, authToken: string) => TwilioWhatsappClient;
type ProviderErrorLike = { code?: unknown; status?: unknown };
type Failure = Extract<EngagementWhatsappGatewayResult, { status: 'failed' }>;

const failed = (
  code: Failure['code'],
  message: string,
  retryable: boolean,
  critical: boolean,
): Failure => ({ status: 'failed', code, message, retryable, critical });

@Injectable()
export class TwilioWhatsappGatewayAdapter implements EngagementWhatsappGatewayPort {
  constructor(
    @Optional()
    private readonly createTwilioClient?: TwilioWhatsappClientFactory,
  ) {}

  isReadyForRoutineDelivery(): boolean {
    const { accountSid, authToken, from } = this.readConfiguration();
    return Boolean(accountSid && authToken && from);
  }

  async send(command: EngagementWhatsappSendCommand): Promise<EngagementWhatsappGatewayResult> {
    const { accountSid, authToken, from } = this.readConfiguration();
    const templateSid = process.env.TWILIO_WHATSAPP_TEMPLATE_SID?.trim();
    if (!accountSid || !authToken || !from) {
      return failed(
        'WHATSAPP_GATEWAY_NOT_CONFIGURED',
        'The WhatsApp gateway is not fully configured.',
        false,
        true,
      );
    }

    try {
      const factory = this.createTwilioClient ?? ((sid: string, token: string) => twilio(sid, token));
      const basePayload = { from: `whatsapp:${from}`, to: `whatsapp:${command.to}` };
      const result = await factory(accountSid, authToken).messages.create(
        templateSid
          ? {
              ...basePayload,
              contentSid: templateSid,
              contentVariables: this.buildTemplateVariables(command.templateData),
            }
          : { ...basePayload, body: command.body },
      );
      return {
        status: 'accepted',
        providerMessageId: result.sid,
        ...this.resolveCost(result),
      };
    } catch (error) {
      return this.describeFailure(error);
    }
  }

  private normalizeProviderAddress(value?: string) {
    return normalizeSmsRecipient(value?.trim().replace(/^whatsapp:/i, ''));
  }

  private readConfiguration() {
    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_AUTH_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_ACCOUNT_TOKEN,
      from: this.normalizeProviderAddress(process.env.TWILIO_WHATSAPP_FROM),
    };
  }

  private buildTemplateVariables(data: EngagementWhatsappTemplateData) {
    return JSON.stringify({
      1: data.name,
      2: data.brand,
      3: data.date,
      4: data.time,
    });
  }

  private resolveCost(
    result: TwilioWhatsappResult,
  ): Pick<Extract<EngagementWhatsappGatewayResult, { status: 'accepted' }>, 'cost'> {
    const providerAmount = result.price ? Math.abs(Number(result.price)) : Number.NaN;
    if (Number.isFinite(providerAmount) && result.priceUnit) {
      return { cost: { amount: providerAmount, currency: result.priceUnit.toUpperCase() } };
    }
    const fallbackRaw = process.env.TWILIO_WHATSAPP_COST_USD?.trim();
    const fallback = fallbackRaw ? Number(fallbackRaw) : Number.NaN;
    return Number.isFinite(fallback) && fallback >= 0
      ? { cost: { amount: fallback, currency: 'USD' } }
      : {};
  }

  private describeFailure(error: unknown): Failure {
    const candidate = (error && typeof error === 'object' ? error : {}) as ProviderErrorLike;
    const code = Number(candidate.code);
    const status = Number(candidate.status);
    if (code === 20003 || status === 401 || status === 403) {
      return failed('WHATSAPP_GATEWAY_AUTH_FAILED', 'The WhatsApp gateway rejected its credentials or permissions.', false, true);
    }
    if (code === 21610) {
      return failed('WHATSAPP_RECIPIENT_OPTED_OUT', 'The recipient has opted out of WhatsApp messages.', false, false);
    }
    if ([21211, 21612, 21614].includes(code)) {
      return failed('WHATSAPP_RECIPIENT_INVALID', 'The recipient phone number is not valid for WhatsApp.', false, false);
    }
    if ([21212, 21606, 21659].includes(code)) {
      return failed('WHATSAPP_SENDER_INVALID', 'The configured WhatsApp sender is invalid or unavailable.', false, true);
    }
    if (code === 20429 || status === 429) {
      return failed('WHATSAPP_RATE_LIMITED', 'The WhatsApp gateway temporarily rate limited the request.', true, false);
    }
    if (status >= 500) {
      return failed('WHATSAPP_GATEWAY_TEMPORARY_FAILURE', 'The WhatsApp gateway is temporarily unavailable.', true, false);
    }
    return failed('WHATSAPP_GATEWAY_DELIVERY_FAILED', 'WhatsApp delivery failed before provider acceptance.', true, false);
  }
}
