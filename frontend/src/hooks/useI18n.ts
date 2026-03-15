import { useCallback } from 'react';
import { translateUi } from '@/lib/i18n';
import { useLanguage } from './useLanguage';

export const useI18n = () => {
  const { language, defaultLanguage } = useLanguage();

  const t = useCallback(
    (key: string, values?: Record<string, string | number>) =>
      translateUi({
        language,
        defaultLanguage,
        key,
        values,
      }),
    [defaultLanguage, language],
  );

  return {
    t,
    language,
    defaultLanguage,
  };
};
