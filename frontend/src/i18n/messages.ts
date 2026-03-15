import esMessages from '@/i18n/locales/es.json';
import enMessages from '@/i18n/locales/en.json';

export type I18nMessages = Record<string, string>;

export const UI_MESSAGES: Record<string, I18nMessages> = {
  es: esMessages as I18nMessages,
  en: enMessages as I18nMessages,
};
