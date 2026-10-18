import { Inject, Injectable } from '@nestjs/common';
import * as twilio from 'twilio';
import { RecordSmsDeliveryStatusUseCase } from '../../application/use-cases/record-sms-delivery-status.use-case';
import {
  SmsDeliveryReceiptStatus,
} from '../../application/commands/record-sms-delivery-status.command';
import {
  ENGAGEMENT_SMS_DELIVERY_STATUS_PORT,
  EngagementSmsDeliveryStatusPort,
  RecordSmsDeliveryStatusResult,
} from '../../ports/outbound/sms-delivery-status.port';
import { buildTwilioSmsStatusCallbackUrl } from './twilio-sms-status-callback';

type TwilioStatusCallbackBody = Record<string, unknown>;

export type TwilioSmsStatusWebhookResult =
  | { outcome: 'recorded'; result: RecordSmsDeliveryStatusResult }
  | { outcome: 'ignored'; providerStatus: string | null }
  | { outcome: 'invalid_signature' }
  | { outcome: 'invalid_payload' }
  | { outcome: 'not_configured' };

const readString = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

export const mapTwilioSmsReceiptStatus = (value: unknown): SmsDeliveryReceiptStatus | null => {
  const status = readString(value, 40).toLowerCase();
  if (status === 'sent') return 'sent';
  if (status === 'delivered') return 'delivered';
  if (status === 'undelivered') return 'undelivered';
  if (status === 'failed' || status === 'canceled') return 'failed';
  return null;
};

const isTwilioMessageSid = (value: string) => /^SM[a-fA-F0-9]{32}$/.test(value);

@Injectable()
export class TwilioSmsStatusWebhookAdapter {
  private readonly recordStatusUseCase: RecordSmsDeliveryStatusUseCase;

  constructor(
    @Inject(ENGAGEMENT_SMS_DELIVERY_STATUS_PORT)
    deliveryStatusPort: EngagementSmsDeliveryStatusPort,
  ) {
    this.recordStatusUseCase = new RecordSmsDeliveryStatusUseCase(deliveryStatusPort);
  }

  async handle(params: {
    deliveryReference: string;
    signature: string;
    body: TwilioStatusCallbackBody;
    occurredAt?: Date;
  }): Promise<TwilioSmsStatusWebhookResult> {
    const authToken = (process.env.TWILIO_ACCOUNT_TOKEN || process.env.TWILIO_AUTH_TOKEN || '').trim();
    const accountSid = (process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_AUTH_SID || '').trim();
    const callbackBaseUrl = (process.env.SMS_STATUS_CALLBACK_URL || '').trim();
    if (!authToken || !accountSid || !callbackBaseUrl) return { outcome: 'not_configured' };

    let callbackUrl: string;
    try {
      callbackUrl = buildTwilioSmsStatusCallbackUrl(callbackBaseUrl, params.deliveryReference);
    } catch {
      return { outcome: 'not_configured' };
    }

    const signatureParams = Object.fromEntries(
      Object.entries(params.body)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        .map(([key, value]) => [key, value]),
    );
    if (!params.signature || !twilio.validateRequest(authToken, params.signature, callbackUrl, signatureParams)) {
      return { outcome: 'invalid_signature' };
    }

    const callbackAccountSid = readString(params.body.AccountSid, 40);
    const providerMessageId = readString(params.body.MessageSid || params.body.SmsSid, 40);
    const providerStatus = readString(params.body.MessageStatus || params.body.SmsStatus, 40).toLowerCase();
    if (callbackAccountSid !== accountSid || !isTwilioMessageSid(providerMessageId)) {
      return { outcome: 'invalid_payload' };
    }

    const status = mapTwilioSmsReceiptStatus(providerStatus);
    if (!status) return { outcome: 'ignored', providerStatus: providerStatus || null };

    const providerErrorCode = readString(params.body.ErrorCode, 40) || null;
    const result = await this.recordStatusUseCase.execute({
      deliveryReference: params.deliveryReference,
      providerMessageId,
      status,
      providerErrorCode,
      occurredAt: params.occurredAt || new Date(),
    });
    return { outcome: 'recorded', result };
  }
}
