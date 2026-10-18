export type SmsRuntimeEnvironment = 'local' | 'test' | 'production' | 'non-production';

export const GLOBAL_SMS_SENDER_ID = 'MANAGGIO';

const normalizeEnvironment = (value?: string | null) => (value || '').trim().toLowerCase();

export const resolveSmsRuntimeEnvironment = (value?: string | null): SmsRuntimeEnvironment => {
  const environment = normalizeEnvironment(value);
  if (!environment || ['development', 'dev', 'local'].includes(environment)) return 'local';
  if (environment === 'test') return 'test';
  if (environment === 'production') return 'production';
  return 'non-production';
};

/** Routine SMS is deliberately fail-closed outside production. */
export const canSendRoutineSms = (value?: string | null) =>
  resolveSmsRuntimeEnvironment(value) === 'production';

/** Manual provider checks are deliberately available only on a local runtime. */
export const canSendPlatformTestSms = (value?: string | null) =>
  resolveSmsRuntimeEnvironment(value) === 'local';

/** The HTTP endpoint is additionally restricted to a loopback/localhost host. */
export const isLocalSmsTestRequestHost = (value?: string | null) => {
  const candidate = value?.trim();
  if (!candidate) return false;
  if (candidate === '::1') return true;
  try {
    const hostname = new URL(
      candidate.includes('://') ? candidate : `http://${candidate}`,
    ).hostname.toLowerCase().replace(/\.$/, '');
    return hostname === 'localhost'
      || hostname.endsWith('.localhost')
      || hostname === '127.0.0.1'
      || hostname === '[::1]';
  } catch {
    return false;
  }
};

/** The direct network peer must also be loopback; Host alone is client-controlled. */
export const isLocalSmsTestRequestAddress = (value?: string | null) => {
  const address = value?.trim().toLowerCase();
  if (!address) return false;
  if (address === '::1' || address === '0:0:0:0:0:0:0:1') return true;
  const ipv4 = address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;
  const parts = ipv4.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const octets = parts.map(Number);
  return octets.every((part) => part >= 0 && part <= 255) && octets[0] === 127;
};

export const isValidSmsStatusCallbackUrl = (
  value?: string | null,
  options: { requireHttps?: boolean } = {},
) => {
  const candidate = value?.trim();
  if (!candidate) return false;
  try {
    const protocol = new URL(candidate).protocol;
    return options.requireHttps ? protocol === 'https:' : ['http:', 'https:'].includes(protocol);
  } catch {
    return false;
  }
};
