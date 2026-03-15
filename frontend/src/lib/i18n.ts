import { enUS, es } from 'date-fns/locale';
import { UI_MESSAGES } from '@/i18n/messages';

const DEFAULT_LOCALE = 'es';

const normalizeLanguageCode = (value?: string | null) =>
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 10);

const interpolate = (template: string, params?: Record<string, string | number>) => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`));
};

const resolveMessage = (language: string, key: string): string | undefined => {
  const exactCatalog = UI_MESSAGES[language];
  if (exactCatalog?.[key]) return exactCatalog[key];
  const baseLanguage = language.split('-')[0];
  if (baseLanguage && UI_MESSAGES[baseLanguage]?.[key]) return UI_MESSAGES[baseLanguage][key];
  return undefined;
};

export const translateUi = (params: {
  language?: string | null;
  defaultLanguage?: string | null;
  key: string;
  values?: Record<string, string | number>;
}) => {
  const language = normalizeLanguageCode(params.language) || DEFAULT_LOCALE;
  const defaultLanguage = normalizeLanguageCode(params.defaultLanguage) || DEFAULT_LOCALE;
  const template =
    resolveMessage(language, params.key) ||
    resolveMessage(defaultLanguage, params.key) ||
    resolveMessage(DEFAULT_LOCALE, params.key) ||
    params.key;
  return interpolate(template, params.values);
};

export const resolveDateLocale = (language?: string | null) => {
  const normalized = normalizeLanguageCode(language);
  const base = normalized.split('-')[0];
  if (base === 'en') return enUS;
  return es;
};
