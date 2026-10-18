export type ManualNotificationDeliveryRetryCandidate = {
  channel: string;
  status: string;
  lastErrorCode?: string | null;
};

const MANUALLY_RETRYABLE_STATUSES = new Set(['failed', 'undelivered', 'skipped']);

const NON_RETRYABLE_MISSING_RECIPIENT_CODES = new Set([
  'EMAIL_RECIPIENT_MISSING',
  'PHONE_RECIPIENT_MISSING',
]);

const NON_RETRYABLE_SMS_CODES = new Set([
  'PHONE_RECIPIENT_INVALID',
  'PHONE_RECIPIENT_MISSING',
  'SMS_DISABLED',
  'SMS_DISABLED_IN_LOCAL',
  'SMS_GATEWAY_AUTH_FAILED',
  'SMS_GATEWAY_CALLBACK_INVALID',
  'SMS_GATEWAY_NOT_CONFIGURED',
  'SMS_LOCAL_DELIVERY_BLOCKED',
  'SMS_MESSAGE_TOO_LONG',
  'SMS_RECIPIENT_INVALID',
  'SMS_RECIPIENT_OPTED_OUT',
  'SMS_ROUTINE_DELIVERY_DISABLED',
  'SMS_SENDER_INVALID',
]);

const NON_RETRYABLE_SMS_PROVIDER_CODES = new Set([
  '21211',
  '21212',
  '21606',
  '21610',
  '21612',
  '21614',
  '21659',
  '21711',
]);

const normalizeErrorCode = (value?: string | null) => (value || '').trim().toUpperCase();

const isPermanentSmsFailure = (errorCode: string) =>
  NON_RETRYABLE_SMS_CODES.has(errorCode)
  || (
    ['SMS_DELIVERY_UNDELIVERED_', 'SMS_DELIVERY_FAILED_'].some(
      (prefix) => errorCode.startsWith(prefix)
        && NON_RETRYABLE_SMS_PROVIDER_CODES.has(errorCode.slice(prefix.length)),
    )
  )
  || /(?:^|_)(?:AUTH_FAILED|CALLBACK_INVALID|CONFIG_INVALID|NOT_CONFIGURED|SENDER_INVALID)$/.test(errorCode)
  || /(?:^|_)(?:RECIPIENT_INVALID|RECIPIENT_OPTED_OUT|MESSAGE_TOO_LONG)$/.test(errorCode);

/**
 * Manual retries are an operational recovery mechanism, not a way to bypass
 * recipient consent, validation or permanent gateway configuration failures.
 */
export const canManuallyRetryNotificationDelivery = (
  candidate: ManualNotificationDeliveryRetryCandidate,
) => {
  if (!MANUALLY_RETRYABLE_STATUSES.has(candidate.status)) return false;

  const errorCode = normalizeErrorCode(candidate.lastErrorCode);
  if (candidate.status === 'skipped' && NON_RETRYABLE_MISSING_RECIPIENT_CODES.has(errorCode)) {
    return false;
  }

  return candidate.channel !== 'sms' || !isPermanentSmsFailure(errorCode);
};
