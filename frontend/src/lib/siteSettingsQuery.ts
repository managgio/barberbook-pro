import { getSiteSettings } from "@/data/api/settings";
import { getStoredLocalId } from "@/lib/tenant";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";

export const SITE_SETTINGS_STALE_TIME = 5 * 60_000;

export const fetchSiteSettingsCached = (localId = getStoredLocalId()) =>
  queryClient.fetchQuery({
    queryKey: queryKeys.siteSettings(localId),
    queryFn: getSiteSettings,
    staleTime: SITE_SETTINGS_STALE_TIME,
  });
