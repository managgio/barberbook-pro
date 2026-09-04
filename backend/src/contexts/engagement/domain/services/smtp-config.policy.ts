export type SmtpConfigInput = {
  user?: unknown;
  password?: unknown;
  host?: unknown;
  port?: unknown;
  fromName?: unknown;
};

export type NormalizedSmtpConfig = {
  user?: string;
  password?: string;
  host?: string;
  port?: number;
  fromName?: string;
};

export type CompleteSmtpConfig = Required<Pick<NormalizedSmtpConfig, 'user' | 'password' | 'host' | 'port'>>
  & Pick<NormalizedSmtpConfig, 'fromName'>;

export type SmtpTransportConfig = {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
  tls: {
    minVersion: 'TLSv1.2';
    servername: string;
  };
  auth: {
    user: string;
    pass: string;
  };
};

const GMAIL_SMTP_HOSTS = new Set(['smtp.gmail.com', 'smtp.googlemail.com']);
const OUTLOOK_DOMAINS = new Set(['outlook.com', 'hotmail.com', 'live.com', 'msn.com']);

const normalizeString = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export const resolveDefaultSmtpHost = (email?: string) => {
  const normalized = normalizeString(email).toLowerCase();
  const domain = normalized.includes('@') ? normalized.split('@')[1] : '';
  const isOutlookFamily = OUTLOOK_DOMAINS.has(domain) || domain.startsWith('outlook.');
  return isOutlookFamily ? 'smtp.office365.com' : 'smtp.gmail.com';
};

const isGoogleSmtp = (host: string, user: string) => {
  if (GMAIL_SMTP_HOSTS.has(host)) return true;
  const domain = user.split('@')[1] || '';
  return domain === 'gmail.com' || domain === 'googlemail.com';
};

export const normalizeSmtpPassword = (password: unknown, host: string, user: string) => {
  const normalized = normalizeString(password);
  if (!normalized) return '';
  return isGoogleSmtp(host, user) ? normalized.replace(/\s+/g, '') : normalized;
};

const normalizePort = (value: unknown) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) return undefined;
  return parsed;
};

export const normalizeSmtpConfig = (input?: SmtpConfigInput | null): NormalizedSmtpConfig | undefined => {
  if (!input) return undefined;
  const user = normalizeString(input.user).toLowerCase();
  const explicitHost = normalizeString(input.host).toLowerCase();
  const host = explicitHost || (user ? resolveDefaultSmtpHost(user) : '');
  const password = normalizeSmtpPassword(input.password, host, user);
  const hasExplicitPort = input.port !== '' && input.port !== null && input.port !== undefined;
  const port = hasExplicitPort ? normalizePort(input.port) : (user || host ? 587 : undefined);
  const fromName = normalizeString(input.fromName);
  const normalized: NormalizedSmtpConfig = {};
  if (user) normalized.user = user;
  if (password) normalized.password = password;
  if (host) normalized.host = host;
  if (port) normalized.port = port;
  if (fromName) normalized.fromName = fromName;
  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

export const requireCompleteSmtpConfig = (input?: SmtpConfigInput | null): CompleteSmtpConfig => {
  const normalized = normalizeSmtpConfig(input);
  if (!normalized?.user || !normalized.password || !normalized.host || !normalized.port) {
    throw new Error('SMTP_CONFIG_INCOMPLETE');
  }
  return normalized as CompleteSmtpConfig;
};

export const buildSmtpTransportConfig = (input: CompleteSmtpConfig): SmtpTransportConfig => ({
  host: input.host,
  port: input.port,
  secure: input.port === 465,
  requireTLS: input.port === 587,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
  tls: {
    minVersion: 'TLSv1.2',
    servername: input.host,
  },
  auth: {
    user: input.user,
    pass: input.password,
  },
});
