import {
  confirmFirebasePasswordReset,
  sendFirebasePasswordResetEmail,
  validateFirebasePassword,
  verifyFirebasePasswordResetCode,
} from '@/lib/firebaseConfig';

export type RecoveryResult = { success: boolean; error?: string; invalidLink?: boolean };
type Translate = (key: string, values?: Record<string, string | number>) => string;
type EnsureReady = () => Promise<unknown>;

const getCode = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code : '';

export const normalizeRecoveryEmail = (email: string) => email.trim().toLowerCase();
export const isRecoveryEmailValid = (email: string) =>
  email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const readPasswordResetAction = (params: URLSearchParams, origin: string, apiKey?: string) => {
  if (params.get('mode') !== 'resetPassword' && !params.has('oobCode')) return null;
  const invalid = { code: '' };
  if (params.get('mode') !== 'resetPassword') return invalid;
  if (['mode', 'oobCode', 'apiKey', 'continueUrl'].some((key) => params.getAll(key).length > 1)) return invalid;
  // The URL never selects a different Firebase project or a redirect destination.
  if (params.has('apiKey') && params.get('apiKey') !== apiKey) return invalid;
  if (params.has('continueUrl')) {
    try {
      if (new URL(params.get('continueUrl')!).origin !== origin) return invalid;
    } catch { return invalid; }
  }
  return { code: params.get('oobCode') || '' };
};

export const recoveryFailure = (error: unknown, t: Translate): RecoveryResult => {
  if (error instanceof Error && error.message === 'FIREBASE_CONFIG_MISSING') {
    return { success: false, error: t('auth.recovery.errors.unavailable') };
  }
  switch (getCode(error)) {
    case 'auth/expired-action-code':
    case 'auth/invalid-action-code':
    case 'auth/user-not-found':
    case 'auth/user-disabled':
      return { success: false, invalidLink: true, error: t('auth.recovery.errors.invalidLink') };
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return { success: false, error: t('auth.errors.invalidEmail') };
    case 'auth/network-request-failed':
    case 'auth/timeout':
      return { success: false, error: t('auth.recovery.errors.network') };
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded':
      return { success: false, error: t('auth.recovery.errors.rateLimit') };
    case 'auth/invalid-continue-uri':
    case 'auth/missing-continue-uri':
    case 'auth/unauthorized-continue-uri':
    case 'auth/operation-not-allowed':
    case 'auth/invalid-api-key':
    case 'auth/app-not-authorized':
    case 'auth/unauthorized-domain':
      return { success: false, error: t('auth.recovery.errors.unavailable') };
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return { success: false, error: t('auth.recovery.errors.passwordPolicy') };
    default:
      return { success: false, error: t('auth.recovery.errors.generic') };
  }
};

export const requestPasswordRecovery = async (
  email: string,
  options: { ensureReady: EnsureReady; origin: string; language: string; t: Translate },
): Promise<RecoveryResult> => {
  const normalized = normalizeRecoveryEmail(email);
  if (!isRecoveryEmailValid(normalized)) return { success: false, error: options.t('auth.errors.invalidEmail') };
  try {
    await options.ensureReady();
    // Keep the tenant host, including local subdomains. Never fall back to another tenant.
    const url = new URL('/auth?tab=login', options.origin).toString();
    await sendFirebasePasswordResetEmail(normalized, { url, handleCodeInApp: false }, options.language);
    return { success: true };
  } catch (error) {
    // A recovery response must not disclose whether an account exists or is disabled.
    if (['auth/user-not-found', 'auth/user-disabled'].includes(getCode(error))) return { success: true };
    return recoveryFailure(error, options.t);
  }
};

export const inspectPasswordRecoveryCode = async (
  code: string, ensureReady: EnsureReady, t: Translate,
): Promise<RecoveryResult> => {
  if (!code || code.length > 2048) return recoveryFailure({ code: 'auth/invalid-action-code' }, t);
  try {
    await ensureReady();
    await verifyFirebasePasswordResetCode(code);
    return { success: true };
  } catch (error) {
    return recoveryFailure(error, t);
  }
};

export const completePasswordRecovery = async (
  code: string, password: string, ensureReady: EnsureReady, t: Translate,
): Promise<RecoveryResult> => {
  if (!code || code.length > 2048) return recoveryFailure({ code: 'auth/invalid-action-code' }, t);
  if (!password) return { success: false, error: t('auth.recovery.errors.passwordRequired') };
  try {
    await ensureReady();
    const policy = await validateFirebasePassword(password);
    if (!policy.isValid) {
      const requirements: string[] = [];
      const options = policy.passwordPolicy.customStrengthOptions;
      if (policy.meetsMinPasswordLength === false) requirements.push(t('auth.recovery.policy.minLength', { count: options.minPasswordLength ?? 6 }));
      if (policy.meetsMaxPasswordLength === false) requirements.push(t('auth.recovery.policy.maxLength', { count: options.maxPasswordLength ?? 4096 }));
      if (policy.containsLowercaseLetter === false) requirements.push(t('auth.recovery.policy.lowercase'));
      if (policy.containsUppercaseLetter === false) requirements.push(t('auth.recovery.policy.uppercase'));
      if (policy.containsNumericCharacter === false) requirements.push(t('auth.recovery.policy.number'));
      if (policy.containsNonAlphanumericCharacter === false) requirements.push(t('auth.recovery.policy.symbol'));
      return { success: false, error: requirements.length
        ? t('auth.recovery.errors.requirements', { requirements: requirements.join(', ') })
        : t('auth.recovery.errors.passwordPolicy') };
    }
    // Firebase validates the one-use code and policy again when committing the change.
    try {
      await confirmFirebasePasswordReset(code, password);
    } catch (error) {
      if (['auth/network-request-failed', 'auth/timeout'].includes(getCode(error))) {
        return { success: false, error: t('auth.recovery.errors.saveUnconfirmed') };
      }
      throw error;
    }
    return { success: true };
  } catch (error) {
    return recoveryFailure(error, t);
  }
};
