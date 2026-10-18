export type NotificationDeliveryDiagnostic = {
  code: string;
  safeMessage: string;
  retryable: boolean;
  critical: boolean;
};

type ProviderErrorLike = {
  code?: unknown;
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
