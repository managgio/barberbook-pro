import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import { LanguageContext } from './language-context';
import { getStoredLanguage, persistLanguage, resolveBrowserLanguage, resolveSupportedLanguages } from '@/lib/language';
import { queryClient } from '@/lib/queryClient';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenant, isReady } = useTenant();
  const { user } = useAuth();
  const isPlatformTenant = Boolean(tenant?.isPlatform);

  const i18nConfig = tenant?.config?.i18n;
  const { defaultLanguage, supportedLanguages } = useMemo(() => {
    if (isPlatformTenant) {
      return {
        defaultLanguage: 'es',
        supportedLanguages: ['es'],
      };
    }
    return resolveSupportedLanguages(i18nConfig?.supportedLanguages || [], i18nConfig?.defaultLanguage);
  }, [i18nConfig?.defaultLanguage, i18nConfig?.supportedLanguages, isPlatformTenant]);

  const [language, setLanguageState] = useState(defaultLanguage);

  useEffect(() => {
    if (!isReady) return;
    if (isPlatformTenant) {
      setLanguageState('es');
      return;
    }
    const brandId = tenant?.brand?.id;
    const storedLanguage = getStoredLanguage({
      brandId,
      userId: user?.id,
    });
    const browserLanguage = resolveBrowserLanguage(supportedLanguages);
    const resolved = [storedLanguage, browserLanguage, defaultLanguage].find(
      (candidate) => candidate && supportedLanguages.includes(candidate),
    ) || defaultLanguage;

    setLanguageState(resolved);
  }, [defaultLanguage, isPlatformTenant, isReady, supportedLanguages, tenant?.brand?.id, user?.id]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback(
    (nextLanguage: string, options?: { persistForUser?: boolean }) => {
      if (isPlatformTenant) return;
      const normalized = nextLanguage.trim().toLowerCase();
      if (!supportedLanguages.includes(normalized)) return;
      if (normalized === language) return;
      setLanguageState(normalized);
      persistLanguage({
        language: normalized,
        brandId: tenant?.brand?.id,
        userId: user?.id,
        persistForUser: options?.persistForUser === true,
      });
      void queryClient.invalidateQueries();
    },
    [isPlatformTenant, language, supportedLanguages, tenant?.brand?.id, user?.id],
  );

  const value = useMemo(
    () => ({
      language,
      defaultLanguage,
      supportedLanguages,
      setLanguage,
    }),
    [defaultLanguage, language, setLanguage, supportedLanguages],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
