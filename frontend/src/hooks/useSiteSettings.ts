import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSiteSettings } from '@/data/api/settings';
import { SiteSettings } from '@/data/types';
import { DEFAULT_SITE_SETTINGS } from '@/data/salonInfo';
import { useTenant } from '@/context/TenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { SITE_SETTINGS_STALE_TIME } from '@/lib/siteSettingsQuery';
import { SITE_SETTINGS_UPDATED_EVENT } from '@/lib/adminEvents';

export const useSiteSettings = () => {
  const { tenant, currentLocationId } = useTenant();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.siteSettings(currentLocationId), [currentLocationId]);
  const brandFallback = tenant?.config?.branding;

  const applyBrandFallback = useCallback((next: SiteSettings) => {
    if (!brandFallback) return next;
    const branding = { ...next.branding };
    if (!branding.name && brandFallback.name) {
      branding.name = brandFallback.name;
    }
    if (!branding.shortName && brandFallback.shortName) {
      branding.shortName = brandFallback.shortName;
    }
    return { ...next, branding };
  }, [brandFallback]);

  const settingsQuery = useQuery({
    queryKey,
    queryFn: getSiteSettings,
    staleTime: SITE_SETTINGS_STALE_TIME,
  });

  const settings = useMemo(
    () => applyBrandFallback(settingsQuery.data || DEFAULT_SITE_SETTINGS),
    [applyBrandFallback, settingsQuery.data],
  );

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
    return queryClient.refetchQueries({ queryKey, type: 'active' });
  }, [queryClient, queryKey]);

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<SiteSettings>;
      if (customEvent.detail) {
        queryClient.setQueryData(queryKey, customEvent.detail);
      }
    };

    window.addEventListener(SITE_SETTINGS_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(SITE_SETTINGS_UPDATED_EVENT, handleUpdate);
  }, [queryClient, queryKey]);

  return {
    settings,
    isLoading: settingsQuery.isLoading && !settingsQuery.data,
    refresh,
  };
};
