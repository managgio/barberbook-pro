import { useCallback, useEffect, useState } from 'react';
import { getSiteSettings } from '@/data/api';
import { SiteSettings } from '@/data/types';
import { DEFAULT_SITE_SETTINGS } from '@/data/salonInfo';

export const useSiteSettings = () => {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getSiteSettings();
      setSettings(data);
    } catch (error) {
      console.error('Error loading site settings', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { settings, isLoading, refresh };
};
