import { getSiteSettings } from "@/data/api/settings";
import { SiteSettings } from "@/data/types";
import { getStoredLocalId } from "@/lib/tenant";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";

export const SITE_SETTINGS_STALE_TIME = 5 * 60_000;

export const fetchSiteSettingsCached = async (localId = getStoredLocalId()) => {
  const queryKey = queryKeys.siteSettings(localId);
  const state = queryClient.getQueryState(queryKey);
  const hasFreshData =
    Boolean(state?.data !== undefined) &&
    state?.fetchStatus !== "fetching" &&
    !state?.isInvalidated &&
    Date.now() - (state?.dataUpdatedAt ?? 0) < SITE_SETTINGS_STALE_TIME;
  if (hasFreshData) {
    const cached = queryClient.getQueryData<SiteSettings>(queryKey);
    if (cached !== undefined) return cached;
  }

  const data = await getSiteSettings();
  queryClient.setQueryData(queryKey, data);
  return data;
};
