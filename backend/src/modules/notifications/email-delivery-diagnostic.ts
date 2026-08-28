export type EmailDeliveryDiagnostic = {
  code: 'SMTP_AUTH_FAILED' | 'EMAIL_DELIVERY_FAILED';
  safeMessage: string;
};

type SmtpErrorLike = {
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
): EmailDeliveryDiagnostic => {
  const candidate = (error && typeof error === 'object' ? error : {}) as SmtpErrorLike;
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
    };
  }

  return {
    code: 'EMAIL_DELIVERY_FAILED',
    safeMessage: `Email delivery failed (${endpoint}).`,
  };
};
