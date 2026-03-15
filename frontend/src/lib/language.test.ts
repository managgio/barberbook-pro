import { beforeEach, describe, expect, it } from 'vitest';
import {
  getStoredLanguage,
  persistLanguage,
  resolveBrowserLanguage,
  resolveSupportedLanguages,
} from '@/lib/language';

describe('language utils', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('resolves supported languages with default first and deduplicated', () => {
    const resolved = resolveSupportedLanguages(['en', 'es', 'en', 'fr'], 'es');
    expect(resolved.defaultLanguage).toBe('es');
    expect(resolved.supportedLanguages).toEqual(['es', 'en', 'fr']);
  });

  it('persists and resolves language priority: user > brand > active', () => {
    persistLanguage({ language: 'es' });
    persistLanguage({ language: 'en', brandId: 'brand-1' });
    persistLanguage({
      language: 'fr',
      brandId: 'brand-2',
      userId: 'user-1',
      persistForUser: true,
    });

    expect(getStoredLanguage({ brandId: 'brand-2', userId: 'user-1' })).toBe('fr');
    expect(getStoredLanguage({ brandId: 'brand-1', userId: 'user-2' })).toBe('en');
    expect(getStoredLanguage({ brandId: 'brand-3' })).toBe('fr');
    expect(getStoredLanguage({})).toBe('fr');
  });

  it('resolves browser language with exact and base fallback', () => {
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'en-US',
    });
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['en-US', 'es-ES'],
    });

    expect(resolveBrowserLanguage(['es', 'en'])).toBe('en');
    expect(resolveBrowserLanguage(['fr'])).toBe('');
  });
});
