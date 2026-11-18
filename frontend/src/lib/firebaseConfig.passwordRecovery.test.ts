import { beforeAll, describe, expect, it, vi } from 'vitest';
import { confirmFirebasePasswordReset, initFirebase, sendFirebasePasswordResetEmail, validateFirebasePassword, verifyFirebasePasswordResetCode } from './firebaseConfig';

const sdk = vi.hoisted(() => ({
  auth: { languageCode: null as string | null },
  sendPasswordResetEmail: vi.fn(), verifyPasswordResetCode: vi.fn(), confirmPasswordReset: vi.fn(), validatePassword: vi.fn(),
}));
vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
  getAuth: () => sdk.auth,
  GoogleAuthProvider: class {}, GithubAuthProvider: class {}, OAuthProvider: class {},
  sendPasswordResetEmail: sdk.sendPasswordResetEmail, verifyPasswordResetCode: sdk.verifyPasswordResetCode,
  confirmPasswordReset: sdk.confirmPasswordReset, validatePassword: sdk.validatePassword,
}));
beforeAll(async () => { await initFirebase({ apiKey: 'test-public-key' }); });

describe('Firebase password recovery adapter', () => {
  it('uses the initialized auth instance, selected language and tenant settings for the email', async () => {
    const settings = { url: 'https://salon.test/auth?tab=login', handleCodeInApp: false };
    await sendFirebasePasswordResetEmail('customer@example.com', settings, 'en');
    expect(sdk.auth.languageCode).toBe('en');
    expect(sdk.sendPasswordResetEmail).toHaveBeenCalledExactlyOnceWith(sdk.auth, 'customer@example.com', settings);
  });
  it('verifies a reset code through the same configured project', async () => {
    sdk.verifyPasswordResetCode.mockResolvedValueOnce('customer@example.com');
    expect(await verifyFirebasePasswordResetCode('test-code')).toBe('customer@example.com');
    expect(sdk.verifyPasswordResetCode).toHaveBeenCalledExactlyOnceWith(sdk.auth, 'test-code');
  });
  it('checks the authoritative project password policy', async () => {
    sdk.validatePassword.mockResolvedValueOnce({ isValid: true });
    expect(await validateFirebasePassword('test-password')).toEqual({ isValid: true });
    expect(sdk.validatePassword).toHaveBeenCalledExactlyOnceWith(sdk.auth, 'test-password');
  });
  it('confirms the reset without signing the user in or changing projects', async () => {
    await confirmFirebasePasswordReset('test-code', 'test-password');
    expect(sdk.confirmPasswordReset).toHaveBeenCalledExactlyOnceWith(sdk.auth, 'test-code', 'test-password');
  });
});
