import { beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmFirebasePasswordReset, sendFirebasePasswordResetEmail, validateFirebasePassword, verifyFirebasePasswordResetCode } from './firebaseConfig';
import { completePasswordRecovery, inspectPasswordRecoveryCode, readPasswordResetAction, requestPasswordRecovery } from './passwordRecovery';
import { translateUi } from './i18n';

vi.mock('./firebaseConfig', () => ({
  confirmFirebasePasswordReset: vi.fn(), sendFirebasePasswordResetEmail: vi.fn(),
  validateFirebasePassword: vi.fn(), verifyFirebasePasswordResetCode: vi.fn(),
}));
const t = (key: string, values?: Record<string, string | number>) => translateUi({ language: 'es', defaultLanguage: 'es', key, values });
const ensureReady = vi.fn();
const options = { ensureReady, origin: 'https://salon.managgio.com', language: 'es', t };

beforeEach(() => {
  vi.resetAllMocks();
  ensureReady.mockResolvedValue(undefined);
  vi.mocked(validateFirebasePassword).mockResolvedValue({ isValid: true } as Awaited<ReturnType<typeof validateFirebasePassword>>);
});

describe('password recovery requests', () => {
  it.each(['https://salon.managgio.com', 'https://www.salon.test', 'http://salon.localhost:8080'])('keeps tenant origin %s and language, normalizing only email', async (origin) => {
    expect(await requestPasswordRecovery('  CUSTOMER@EXAMPLE.COM ', { ...options, origin, language: 'en' })).toEqual({ success: true });
    expect(sendFirebasePasswordResetEmail).toHaveBeenCalledExactlyOnceWith('customer@example.com', { url: `${origin}/auth?tab=login`, handleCodeInApp: false }, 'en');
  });
  it.each(['', 'bad', 'a@@example.com', 'a @example.com', 'x'.repeat(255) + '@example.com'])('rejects malformed email without reaching the provider: %s', async (email) => {
    expect(await requestPasswordRecovery(email, options)).toEqual({ success: false, error: t('auth.errors.invalidEmail') });
    expect(ensureReady).not.toHaveBeenCalled();
    expect(sendFirebasePasswordResetEmail).not.toHaveBeenCalled();
  });
  it.each(['auth/user-not-found', 'auth/user-disabled'])('does not enumerate accounts for %s', async (code) => {
    vi.mocked(sendFirebasePasswordResetEmail).mockRejectedValue({ code });
    expect(await requestPasswordRecovery('customer@example.com', options)).toEqual({ success: true });
  });
  it.each(['auth/invalid-continue-uri', 'auth/missing-continue-uri', 'auth/unauthorized-continue-uri'])('never retries without tenant return URL for %s', async (code) => {
    vi.mocked(sendFirebasePasswordResetEmail).mockRejectedValue({ code, message: 'private provider details' });
    expect(await requestPasswordRecovery('customer@example.com', options)).toEqual({ success: false, error: t('auth.recovery.errors.unavailable') });
    expect(sendFirebasePasswordResetEmail).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['auth/network-request-failed', 'network'], ['auth/timeout', 'network'],
    ['auth/too-many-requests', 'rateLimit'], ['auth/quota-exceeded', 'rateLimit'],
    ['auth/operation-not-allowed', 'unavailable'], ['auth/invalid-api-key', 'unavailable'],
    ['auth/internal-error', 'generic'],
  ])('gives an actionable safe error for %s', async (code, key) => {
    vi.mocked(sendFirebasePasswordResetEmail).mockRejectedValue({ code, message: 'private provider details' });
    expect(await requestPasswordRecovery('customer@example.com', options)).toEqual({ success: false, error: t(`auth.recovery.errors.${key}`) });
  });
  it('handles missing Firebase configuration without exposing implementation details', async () => {
    ensureReady.mockRejectedValue(new Error('FIREBASE_CONFIG_MISSING'));
    expect(await requestPasswordRecovery('customer@example.com', options)).toEqual({ success: false, error: t('auth.recovery.errors.unavailable') });
  });
});

describe('password action links', () => {
  it('ignores normal auth URLs', () => expect(readPasswordResetAction(new URLSearchParams('tab=login'), options.origin)).toBeNull());
  it('uses only configured project and same-tenant continue URL', () => {
    const params = new URLSearchParams({ mode: 'resetPassword', oobCode: 'one-use-code', apiKey: 'configured', continueUrl: `${options.origin}/auth?tab=login` });
    expect(readPasswordResetAction(params, options.origin, 'configured')).toEqual({ code: 'one-use-code' });
    expect(readPasswordResetAction(params, options.origin, 'other-project')).toEqual({ code: '' });
    params.set('continueUrl', 'https://other-tenant.managgio.com/auth');
    expect(readPasswordResetAction(params, options.origin, 'configured')).toEqual({ code: '' });
  });
  it.each(['mode=resetPassword', 'oobCode=code', 'mode=verifyEmail&oobCode=code', 'mode=resetPassword&oobCode=code&continueUrl=garbage'])('rejects incomplete or unsupported action: %s', (query) => {
    expect(readPasswordResetAction(new URLSearchParams(query), options.origin)).toEqual({ code: '' });
  });
  it('rejects ambiguous duplicate security parameters', () => {
    expect(readPasswordResetAction(new URLSearchParams('mode=resetPassword&oobCode=first&oobCode=second'), options.origin)).toEqual({ code: '' });
  });
  it('verifies the code without consuming it', async () => {
    expect(await inspectPasswordRecoveryCode('one-use-code', ensureReady, t)).toEqual({ success: true });
    expect(verifyFirebasePasswordResetCode).toHaveBeenCalledWith('one-use-code');
    expect(confirmFirebasePasswordReset).not.toHaveBeenCalled();
  });
  it.each(['', 'x'.repeat(2049)])('rejects missing or oversized codes before SDK access', async (code) => {
    expect(await inspectPasswordRecoveryCode(code, ensureReady, t)).toMatchObject({ success: false, invalidLink: true });
    expect(await completePasswordRecovery(code, 'secret', ensureReady, t)).toMatchObject({ success: false, invalidLink: true });
    expect(ensureReady).not.toHaveBeenCalled();
  });
  it.each(['auth/expired-action-code', 'auth/invalid-action-code', 'auth/user-not-found', 'auth/user-disabled'])('treats %s as an unusable link', async (code) => {
    vi.mocked(verifyFirebasePasswordResetCode).mockRejectedValue({ code });
    expect(await inspectPasswordRecoveryCode('one-use-code', ensureReady, t)).toEqual({ success: false, invalidLink: true, error: t('auth.recovery.errors.invalidLink') });
  });
});

describe('password reset commit', () => {
  it('preserves password spaces and confirms only after policy validation', async () => {
    expect(await completePasswordRecovery('code', '  Passw0rd!  ', ensureReady, t)).toEqual({ success: true });
    expect(validateFirebasePassword).toHaveBeenCalledWith('  Passw0rd!  ');
    expect(confirmFirebasePasswordReset).toHaveBeenCalledExactlyOnceWith('code', '  Passw0rd!  ');
  });
  it('does not commit empty passwords', async () => {
    expect(await completePasswordRecovery('code', '', ensureReady, t)).toEqual({ success: false, error: t('auth.recovery.errors.passwordRequired') });
    expect(confirmFirebasePasswordReset).not.toHaveBeenCalled();
  });
  it('explains actual project policy and does not commit weak passwords', async () => {
    vi.mocked(validateFirebasePassword).mockResolvedValue({
      isValid: false, meetsMinPasswordLength: false, containsUppercaseLetter: false, containsNumericCharacter: false,
      passwordPolicy: { customStrengthOptions: { minPasswordLength: 12 } },
    } as Awaited<ReturnType<typeof validateFirebasePassword>>);
    const result = await completePasswordRecovery('code', 'short', ensureReady, t);
    expect(result.error).toContain('12');
    expect(result.error).toContain('mayúscula');
    expect(result.error).toContain('número');
    expect(confirmFirebasePasswordReset).not.toHaveBeenCalled();
  });
  it('handles code consumed concurrently between verification and commit', async () => {
    vi.mocked(confirmFirebasePasswordReset).mockRejectedValue({ code: 'auth/invalid-action-code' });
    expect(await completePasswordRecovery('code', 'Passw0rd!', ensureReady, t)).toMatchObject({ success: false, invalidLink: true });
  });
  it('handles a policy change between validation and commit', async () => {
    vi.mocked(confirmFirebasePasswordReset).mockRejectedValue({ code: 'auth/password-does-not-meet-requirements' });
    expect(await completePasswordRecovery('code', 'Passw0rd!', ensureReady, t)).toEqual({ success: false, error: t('auth.recovery.errors.passwordPolicy') });
  });
  it('explains uncertain delivery of a commit response without claiming the password was saved', async () => {
    vi.mocked(confirmFirebasePasswordReset).mockRejectedValue({ code: 'auth/network-request-failed' });
    expect(await completePasswordRecovery('code', 'Passw0rd!', ensureReady, t)).toEqual({ success: false, error: t('auth.recovery.errors.saveUnconfirmed') });
  });
});
