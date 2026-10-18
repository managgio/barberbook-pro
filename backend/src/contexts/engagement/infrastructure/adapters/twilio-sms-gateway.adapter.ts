import { Injectable, Optional } from '@nestjs/common';
import * as twilio from 'twilio';
import {
  EngagementSmsGatewayPort,
  EngagementSmsGatewayResult,
  EngagementSmsSendCommand,
} from '../../ports/outbound/sms-gateway.port';
import {
  canSendPlatformTestSms,
  canSendRoutineSms,
  GLOBAL_SMS_SENDER_ID,
  isValidSmsStatusCallbackUrl,
} from '../../domain/services/sms-delivery-runtime.policy';
import { buildTwilioSmsStatusCallbackUrl } from './twilio-sms-status-callback';
import { analyzeSmsSegmentation } from '../../domain/services/sms-segmentation.policy';

type TwilioSmsPayload = {
  to: string;
  body: string;
  from: string;
  messagingServiceSid: string;
  statusCallback?: string;
};

type TwilioSmsResult = {
  sid: string;
  from?: string | null;
  price: string | null;
  priceUnit: string | null;
};

type TwilioSmsClient = {
  messages: {
    create(payload: TwilioSmsPayload): Promise<TwilioSmsResult>;
  };
};

type TwilioSmsClientFactory = (accountSid: string, authToken: string) => TwilioSmsClient;

type ProviderErrorLike = {
  code?: unknown;
  status?: unknown;
};

const failed = (
  code: Extract<EngagementSmsGatewayResult, { status: 'failed' }>['code'],
  message: string,
  retryable: boolean,
  critical: boolean,
): EngagementSmsGatewayResult => ({ status: 'failed', code, message, retryable, critical });

@Injectable()
export class TwilioSmsGatewayAdapter implements EngagementSmsGatewayPort {
  constructor(
    @Optional()
    private readonly createTwilioClient?: TwilioSmsClientFactory,
  ) {}

  isReadyForRoutineDelivery(): boolean {
    const { accountSid, authToken, messagingServiceSid } = this.readConfiguration();
    const callbackUrl = process.env.SMS_STATUS_CALLBACK_URL?.trim();
    return Boolean(
      accountSid
      && authToken
      && messagingServiceSid
      && callbackUrl
      && isValidSmsStatusCallbackUrl(callbackUrl, { requireHttps: true }),
    );
  }

  async send(command: EngagementSmsSendCommand): Promise<EngagementSmsGatewayResult> {
    if (command.purpose === 'routine' && !canSendRoutineSms(process.env.NODE_ENV)) {
      return failed(
        'SMS_ROUTINE_DELIVERY_DISABLED',
        'Routine SMS delivery is disabled outside production.',
        false,
        false,
      );
    }
    if (command.purpose === 'platform_test' && !canSendPlatformTestSms(process.env.NODE_ENV)) {
      return failed(
        'SMS_TEST_LOCAL_ONLY',
        'Platform SMS tests are only available in a local environment.',
        false,
        false,
      );
    }

    const { accountSid, authToken, messagingServiceSid } = this.readConfiguration();
    if (!accountSid || !authToken || !messagingServiceSid) {
      return failed(
        'SMS_GATEWAY_NOT_CONFIGURED',
        `The SMS gateway is not fully configured for the global ${GLOBAL_SMS_SENDER_ID} sender.`,
        false,
        true,
      );
    }

    const statusCallback = this.resolveStatusCallback(command.deliveryReference);
    if (statusCallback === null) {
      return failed(
        'SMS_GATEWAY_CALLBACK_INVALID',
        'The SMS delivery callback URL is invalid.',
        false,
        true,
      );
    }

    try {
      const factory = this.createTwilioClient ?? ((sid: string, token: string) => twilio(sid, token));
      const result = await factory(accountSid, authToken).messages.create({
        to: command.to,
        body: command.body,
        from: GLOBAL_SMS_SENDER_ID,
        messagingServiceSid,
        ...(statusCallback ? { statusCallback } : {}),
      });
      return {
        status: 'accepted',
        providerMessageId: result.sid,
        ...(result.from?.trim() ? { sender: result.from.trim() } : {}),
        ...this.resolveCost(result, command.body),
      };
    } catch (error) {
      return this.describeFailure(error);
    }
  }

  private readConfiguration() {
    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_AUTH_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_ACCOUNT_TOKEN,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID?.trim(),
    };
  }

  private resolveStatusCallback(deliveryReference?: string) {
    if (!deliveryReference) return undefined;
    const raw = process.env.SMS_STATUS_CALLBACK_URL?.trim();
    if (!raw) return null;
    try {
      if (!isValidSmsStatusCallbackUrl(raw, { requireHttps: process.env.NODE_ENV === 'production' })) {
        return null;
      }
      return buildTwilioSmsStatusCallbackUrl(raw, deliveryReference);
    } catch {
      return null;
    }
  }

  private resolveCost(
    result: TwilioSmsResult,
    body: string,
  ): Pick<Extract<EngagementSmsGatewayResult, { status: 'accepted' }>, 'cost'> {
    const providerAmount = result.price ? Math.abs(Number(result.price)) : Number.NaN;
    if (Number.isFinite(providerAmount) && result.priceUnit) {
      return { cost: { amount: providerAmount, currency: result.priceUnit.toUpperCase() } };
    }
    const fallbackRaw = process.env.TWILIO_SMS_COST_USD?.trim();
    const fallback = fallbackRaw ? Number(fallbackRaw) : Number.NaN;
    return Number.isFinite(fallback) && fallback >= 0
      ? {
          cost: {
            amount: fallback * Math.max(1, analyzeSmsSegmentation(body).segments),
            currency: 'USD',
          },
        }
      : {};
  }

  private describeFailure(error: unknown): EngagementSmsGatewayResult {
    const candidate = (error && typeof error === 'object' ? error : {}) as ProviderErrorLike;
    const code = Number(candidate.code);
    const status = Number(candidate.status);

    if (code === 20003 || status === 401 || status === 403) {
      return failed('SMS_GATEWAY_AUTH_FAILED', 'The SMS gateway rejected its credentials or permissions.', false, true);
    }
    if (code === 21610) {
      return failed('SMS_RECIPIENT_OPTED_OUT', 'The recipient has opted out of SMS messages.', false, false);
    }
    if ([21211, 21612, 21614].includes(code)) {
      return failed('SMS_RECIPIENT_INVALID', 'The recipient phone number is not valid for SMS.', false, false);
    }
    if ([21212, 21606, 21659, 21711].includes(code)) {
      return failed('SMS_SENDER_INVALID', 'The configured global SMS sender is invalid or unavailable.', false, true);
    }
    if (code === 20429 || status === 429) {
      return failed('SMS_RATE_LIMITED', 'The SMS gateway temporarily rate limited the request.', true, false);
    }
    if (status >= 500) {
      return failed('SMS_GATEWAY_TEMPORARY_FAILURE', 'The SMS gateway is temporarily unavailable.', true, false);
    }
    return failed('SMS_GATEWAY_DELIVERY_FAILED', 'SMS delivery failed before provider acceptance.', true, false);
  }
}
