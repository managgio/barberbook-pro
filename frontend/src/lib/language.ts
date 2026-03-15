export type LanguageOption = {
  code: string;
  label: string;
  nativeLabel: string;
};

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'es', label: 'Español', nativeLabel: 'Español' },
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch' },
  { code: 'it', label: 'Italian', nativeLabel: 'Italiano' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português' },
  { code: 'ca', label: 'Catalan', nativeLabel: 'Català' },
];

const ACTIVE_LANGUAGE_KEY = 'managgio.language.active';
const DEFAULT_LANGUAGE = 'es';

const normalizeLanguageCode = (value?: string | null) =>
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 10);

const buildBrandLanguageKey = (brandId: string) => `managgio.language.brand:${brandId}`;
const buildUserLanguageKey = (brandId: string, userId: string) => `managgio.language.user:${brandId}:${userId}`;

const safeGet = (key: string) => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (key: string, value: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (!value) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
};

export const resolveSupportedLanguages = (
  supportedLanguages?: string[] | null,
  defaultLanguage?: string | null,
): { defaultLanguage: string; supportedLanguages: string[] } => {
  const normalizedDefault = normalizeLanguageCode(defaultLanguage) || DEFAULT_LANGUAGE;
  const normalizedSupported = Array.from(
    new Set(
      [normalizedDefault, ...(supportedLanguages || [])]
        .map((code) => normalizeLanguageCode(code))
        .filter(Boolean),
    ),
  );

  return {
    defaultLanguage: normalizedDefault,
    supportedLanguages: normalizedSupported.length > 0 ? normalizedSupported : [normalizedDefault],
  };
};

export const resolveBrowserLanguage = (supportedLanguages: string[]) => {
  if (typeof navigator === 'undefined') return '';
  const candidates = [
    navigator.language,
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeLanguageCode(candidate);
    if (!normalized) continue;
    if (supportedLanguages.includes(normalized)) return normalized;
    const base = normalized.split('-')[0];
    if (supportedLanguages.includes(base)) return base;
  }

  return '';
};

export const getLanguageOption = (code?: string | null): LanguageOption => {
  const normalized = normalizeLanguageCode(code) || DEFAULT_LANGUAGE;
  return (
    LANGUAGE_OPTIONS.find((option) => option.code === normalized) || {
      code: normalized,
      label: normalized.toUpperCase(),
      nativeLabel: normalized.toUpperCase(),
    }
  );
};

export const getStoredLanguage = (params: {
  brandId?: string | null;
  userId?: string | null;
}): string => {
  const { brandId, userId } = params;
  if (brandId && userId) {
    const userLanguage = normalizeLanguageCode(safeGet(buildUserLanguageKey(brandId, userId)));
    if (userLanguage) return userLanguage;
  }

  if (brandId) {
    const brandLanguage = normalizeLanguageCode(safeGet(buildBrandLanguageKey(brandId)));
    if (brandLanguage) return brandLanguage;
  }

  return normalizeLanguageCode(safeGet(ACTIVE_LANGUAGE_KEY));
};

export const persistLanguage = (params: {
  language: string;
  brandId?: string | null;
  userId?: string | null;
  persistForUser?: boolean;
}) => {
  const normalizedLanguage = normalizeLanguageCode(params.language);
  if (!normalizedLanguage) return;
  safeSet(ACTIVE_LANGUAGE_KEY, normalizedLanguage);

  if (params.brandId) {
    safeSet(buildBrandLanguageKey(params.brandId), normalizedLanguage);
    if (params.persistForUser && params.userId) {
      safeSet(buildUserLanguageKey(params.brandId, params.userId), normalizedLanguage);
    }
  }
};

export const getRequestLanguage = () => normalizeLanguageCode(safeGet(ACTIVE_LANGUAGE_KEY));
