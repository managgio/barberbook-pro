import { useCallback, useEffect, useState } from 'react';
import { getSiteSettings } from '@/data/api';
import { SiteSettings } from '@/data/types';
import { DEFAULT_SITE_SETTINGS } from '@/data/salonInfo';
import { useTenant } from '@/context/TenantContext';

export const useSiteSettings = () => {
  const { tenant, currentLocationId } = useTenant();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const applyBrandFallback = useCallback((next: SiteSettings) => {
    const fallback = tenant?.config?.branding;
    if (!fallback) return next;
    const branding = { ...next.branding };
    if (!branding.name && fallback.name) {
      branding.name = fallback.name;
    }
    if (!branding.shortName && fallback.shortName) {
      branding.shortName = fallback.shortName;
    }
    return { ...next, branding };
  }, [tenant?.config?.branding?.name, tenant?.config?.branding?.shortName]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getSiteSettings();
      setSettings(applyBrandFallback(data));
    } catch (error) {
      console.error('Error loading site settings', error);
    } finally {
      setIsLoading(false);
    }
  }, [applyBrandFallback]);

  useEffect(() => {
    refresh();
  }, [refresh, currentLocationId]);

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<SiteSettings>;
      if (customEvent.detail) {
        setSettings(applyBrandFallback(customEvent.detail));
      }
    };

    window.addEventListener('site-settings-updated', handleUpdate);
    return () => window.removeEventListener('site-settings-updated', handleUpdate);
  }, [applyBrandFallback]);

  useEffect(() => {
    setSettings((prev) => applyBrandFallback(prev));
  }, [applyBrandFallback]);

  return { settings, isLoading, refresh };
};
