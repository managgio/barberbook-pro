import {
  getSmtpConfigValidationIssue,
  normalizeSmtpConfig,
  SmtpConfigInput,
} from '../../contexts/engagement/domain/services/smtp-config.policy';
import { stripProviderOwnedMessagingConfig } from '../../contexts/platform/domain/services/tenant-config-sanitization.policy';

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};

const readPassword = (value: unknown) => typeof value === 'string' && value.trim() ? value : undefined;

export const redactPlatformEmailSecret = (configValue: unknown): JsonRecord => {
  const config = stripProviderOwnedMessagingConfig(configValue);
  const email = asRecord(config.email);
  if (Object.keys(email).length === 0) return { ...config };
  const passwordConfigured = Boolean(readPassword(email.password));
  const validationIssue = getSmtpConfigValidationIssue(email);
  const publicEmail: JsonRecord = {
    ...email,
    passwordConfigured,
    validationCode: validationIssue?.code || null,
  };
  delete publicEmail.password;
  return { ...config, email: publicEmail };
};

export const preparePlatformConfigUpdate = (
  currentValue: unknown,
  incomingValue: unknown,
): JsonRecord => {
  const current = stripProviderOwnedMessagingConfig(currentValue);
  const incoming = stripProviderOwnedMessagingConfig(incomingValue);
  if (!Object.prototype.hasOwnProperty.call(incoming, 'email')) {
    return current.email ? { ...incoming, email: current.email } : { ...incoming };
  }

  const currentEmail = asRecord(current.email);
  const incomingEmail = asRecord(incoming.email);
  const suppliedPassword = readPassword(incomingEmail.password);
  const storedPassword = readPassword(currentEmail.password);
  const hasIncomingEmailDetails = ['user', 'host', 'port', 'fromName']
    .some((field) => String(incomingEmail[field] ?? '').trim().length > 0);
  if (!suppliedPassword && !hasIncomingEmailDetails) {
    const result = { ...incoming };
    delete result.email;
    return result;
  }
  const normalizedEmail = normalizeSmtpConfig({
    ...incomingEmail,
    password: suppliedPassword ?? storedPassword,
  });

  if (!normalizedEmail) {
    const result = { ...incoming };
    delete result.email;
    return result;
  }
  return { ...incoming, email: normalizedEmail };
};

export const resolvePlatformEmailVerificationConfig = (
  currentValue: unknown,
  candidateValue: unknown,
) => {
  const currentEmail = asRecord(asRecord(currentValue).email);
  const candidateEmail = asRecord(candidateValue);
  const candidatePassword = readPassword(candidateEmail.password);
  return normalizeSmtpConfig({
    ...currentEmail,
    ...candidateEmail,
    password: candidatePassword ?? readPassword(currentEmail.password),
  });
};

const connectionFingerprint = (input: SmtpConfigInput | undefined) => {
  const normalized = normalizeSmtpConfig(input);
  return JSON.stringify({
    user: normalized?.user || null,
    password: normalized?.password || null,
    host: normalized?.host || null,
    port: normalized?.port || null,
  });
};

export const hasPlatformEmailConnectionChanged = (currentValue: unknown, preparedValue: unknown) => {
  const currentEmail = asRecord(asRecord(currentValue).email);
  const preparedEmail = asRecord(asRecord(preparedValue).email);
  return connectionFingerprint(currentEmail) !== connectionFingerprint(preparedEmail);
};
