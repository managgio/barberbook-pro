import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  ENGAGEMENT_SMS_GATEWAY_PORT,
  EngagementSmsGatewayPort,
} from '../../contexts/engagement/ports/outbound/sms-gateway.port';
import {
  canSendPlatformTestSms,
  GLOBAL_SMS_SENDER_ID,
  isLocalSmsTestRequestAddress,
  isLocalSmsTestRequestHost,
} from '../../contexts/engagement/domain/services/sms-delivery-runtime.policy';
import { normalizeSmsRecipient } from '../../contexts/engagement/domain/services/sms-recipient.policy';
import {
  analyzeSmsSegmentation,
  SMS_MAX_STANDARD_SEGMENTS,
} from '../../contexts/engagement/domain/services/sms-segmentation.policy';

@Injectable()
export class PlatformSmsTestService {
  private readonly recipientCooldowns = new Map<string, number>();
  private lastAttemptAt = 0;

  constructor(
    @Inject(ENGAGEMENT_SMS_GATEWAY_PORT)
    private readonly smsGateway: EngagementSmsGatewayPort,
  ) {}

  async send(
    phone: string,
    message: string | null | undefined,
    requestHost?: string | null,
    requestAddress?: string | null,
  ) {
    if (
      !canSendPlatformTestSms(process.env.NODE_ENV)
      || !isLocalSmsTestRequestHost(requestHost)
      || !isLocalSmsTestRequestAddress(requestAddress)
    ) {
      throw new ForbiddenException({
        code: 'SMS_TEST_LOCAL_ONLY',
        message: 'El SMS de prueba solo está disponible en el entorno local.',
      });
    }

    const recipient = normalizeSmsRecipient(phone);
    if (!recipient) {
      throw new BadRequestException({
        code: 'SMS_RECIPIENT_INVALID',
        message: 'El teléfono debe tener un formato internacional válido.',
      });
    }
    const body = message?.trim() || `${GLOBAL_SMS_SENDER_ID}: SMS de prueba local.`;
    if (analyzeSmsSegmentation(body).segments > SMS_MAX_STANDARD_SEGMENTS) {
      throw new BadRequestException({
        code: 'SMS_MESSAGE_TOO_LONG',
        message: `El SMS no puede superar ${SMS_MAX_STANDARD_SEGMENTS} segmentos.`,
      });
    }
    this.reserveCooldown(recipient);
    const result = await this.smsGateway.send({ to: recipient, body, purpose: 'platform_test' });
    if (result.status === 'accepted') {
      const actualSender = result.sender?.trim();
      return {
        success: true,
        providerMessageId: result.providerMessageId,
        ...(actualSender
          ? {
              actualSender,
              senderMatchesExpected: actualSender.toUpperCase() === GLOBAL_SMS_SENDER_ID,
            }
          : {}),
      };
    }

    const payload = { code: result.code, message: result.message };
    if (result.critical || result.retryable) throw new ServiceUnavailableException(payload);
    throw new BadRequestException(payload);
  }

  private reserveCooldown(recipient: string) {
    const now = Date.now();
    const recipientKey = createHash('sha256').update(recipient).digest('hex');
    const recipientReadyAt = this.recipientCooldowns.get(recipientKey) || 0;
    const globalReadyAt = this.lastAttemptAt + 5_000;
    const readyAt = Math.max(recipientReadyAt, globalReadyAt);
    if (readyAt > now) {
      throw new HttpException(
        {
          code: 'SMS_TEST_COOLDOWN',
          message: 'Espera unos segundos antes de enviar otro SMS de prueba.',
          retryAfterSeconds: Math.ceil((readyAt - now) / 1_000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.lastAttemptAt = now;
    this.recipientCooldowns.set(recipientKey, now + 30_000);
    if (this.recipientCooldowns.size > 100) {
      for (const [key, expiresAt] of this.recipientCooldowns) {
        if (expiresAt <= now) this.recipientCooldowns.delete(key);
      }
    }
  }
}
