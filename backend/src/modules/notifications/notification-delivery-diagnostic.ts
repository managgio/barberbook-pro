export type NotificationDeliveryDiagnostic = {
  code: string;
  safeMessage: string;
  retryable: boolean;
  critical: boolean;
};

type ProviderErrorLike = {
  code?: unknown;
  status?: unknown;
  responseCode?: unknown;
  message?: unknown;
  response?: unknown;
};

const stringify = (value: unknown) => typeof value === 'string' ? value : '';

export const maskEmailIdentity = (email?: string | null) => {
  const normalized = (email || '').trim();
  const [name, domain] = normalized.split('@');
  if (!name || !domain) return 'not-configured';
  return `${name.slice(0, 1)}***@${domain}`;
};

export const describeEmailDeliveryError = (
  error: unknown,
  smtp: { host?: string | null; user?: string | null },
): NotificationDeliveryDiagnostic => {
  const candidate = (error && typeof error === 'object' ? error : {}) as ProviderErrorLike;
  const message = stringify(candidate.message) || stringify(candidate.response) || String(error);
  const isAuthenticationFailure =
    candidate.code === 'EAUTH'
    || candidate.responseCode === 535
    || /\b535(?:-|\s)|username and password not accepted|authentication unsuccessful/i.test(message);
  const endpoint = `${smtp.host || 'unknown-host'} user=${maskEmailIdentity(smtp.user)}`;

  if (isAuthenticationFailure) {
    return {
      code: 'SMTP_AUTH_FAILED',
      safeMessage: `SMTP authentication rejected (${endpoint}). Check the tenant sender credentials or app password.`,
      retryable: false,
      critical: true,
    };
  }

  const responseCode = typeof candidate.responseCode === 'number' ? candidate.responseCode : null;
  const isRecipientRejected =
    candidate.code === 'EENVELOPE'
    || responseCode === 550
    || responseCode === 551
    || responseCode === 553
    || /recipient address rejected|mailbox unavailable|user unknown|no such user/i.test(message);
  if (isRecipientRejected) {
    return {
      code: 'EMAIL_RECIPIENT_REJECTED',
      safeMessage: 'The recipient address was rejected by the destination server.',
      retryable: false,
      critical: false,
    };
  }

  const isTemporaryFailure =
    (responseCode !== null && responseCode >= 400 && responseCode < 500)
    || ['ETIMEDOUT', 'ECONNECTION', 'ECONNRESET', 'ESOCKET', 'EAI_AGAIN'].includes(String(candidate.code || ''));
  if (isTemporaryFailure) {
    return {
      code: 'SMTP_TEMPORARY_FAILURE',
      safeMessage: `Temporary SMTP delivery failure (${endpoint}).`,
      retryable: true,
      critical: false,
    };
  }

  return {
    code: 'EMAIL_DELIVERY_FAILED',
    safeMessage: `Email delivery failed (${endpoint}).`,
    retryable: true,
    critical: false,
  };
};

export const describeTwilioDeliveryError = (
  error: unknown,
  channel: 'sms' | 'whatsapp',
): NotificationDeliveryDiagnostic => {
  const candidate = (error && typeof error === 'object' ? error : {}) as ProviderErrorLike;
  const code = Number(candidate.code);
  const status = Number(candidate.status);
  const channelLabel = channel === 'sms' ? 'SMS' : 'WhatsApp';

  if (code === 20003 || status === 401 || status === 403) {
    return {
      code: 'TWILIO_AUTH_FAILED',
      safeMessage: 'Twilio rejected the tenant credentials or permissions.',
      retryable: false,
      critical: true,
    };
  }
  if ([21211, 21610, 21612, 21614].includes(code)) {
    return {
      code: code === 21610 ? 'RECIPIENT_OPTED_OUT' : 'PHONE_RECIPIENT_INVALID',
      safeMessage: code === 21610
        ? `The recipient has opted out of ${channelLabel} messages.`
        : `The recipient phone number is not valid for ${channelLabel}.`,
      retryable: false,
      critical: false,
    };
  }
  if ([21212, 21606, 21659].includes(code)) {
    return {
      code: 'TWILIO_SENDER_INVALID',
      safeMessage: `The configured ${channelLabel} sender is invalid or unavailable.`,
      retryable: false,
      critical: true,
    };
  }
  if (code === 20429 || status === 429 || status >= 500) {
    return {
      code: code === 20429 || status === 429 ? 'TWILIO_RATE_LIMITED' : 'TWILIO_TEMPORARY_FAILURE',
      safeMessage: `Twilio temporarily rejected the ${channelLabel} request.`,
      retryable: true,
      critical: false,
    };
  }
  return {
    code: 'TWILIO_DELIVERY_FAILED',
    safeMessage: `${channelLabel} delivery failed before provider acceptance.`,
    retryable: true,
    critical: false,
  };
};
