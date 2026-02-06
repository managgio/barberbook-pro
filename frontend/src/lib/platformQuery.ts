import {
  getPlatformBrand,
  getPlatformBrandAdmins,
  getPlatformBrandConfig,
  getPlatformBrandDpa,
  getPlatformBrandLegalSettings,
  getPlatformBrands,
  getPlatformLocationConfig,
} from '@/data/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

export const PLATFORM_STALE_TIME = 60_000;

const resolveStaleTime = (force?: boolean) => (force ? 0 : PLATFORM_STALE_TIME);

export const fetchPlatformBrandsCached = (options?: { force?: boolean }) =>
  queryClient.fetchQuery({
    queryKey: queryKeys.platformBrands(),
    queryFn: getPlatformBrands,
    staleTime: resolveStaleTime(options?.force),
  });

export const fetchPlatformBrandCached = (
  brandId: string,
  options?: { force?: boolean },
) =>
  queryClient.fetchQuery({
    queryKey: queryKeys.platformBrand(brandId),
    queryFn: () => getPlatformBrand(brandId),
    staleTime: resolveStaleTime(options?.force),
  });

export const fetchPlatformBrandConfigCached = (
  brandId: string,
  options?: { force?: boolean },
) =>
  queryClient.fetchQuery({
    queryKey: queryKeys.platformBrandConfig(brandId),
    queryFn: () => getPlatformBrandConfig(brandId),
    staleTime: resolveStaleTime(options?.force),
  });

export const fetchPlatformBrandAdminsCached = (
  brandId: string,
  options?: { force?: boolean },
) =>
  queryClient.fetchQuery({
    queryKey: queryKeys.platformBrandAdmins(brandId),
    queryFn: () => getPlatformBrandAdmins(brandId),
    staleTime: resolveStaleTime(options?.force),
  });

export const fetchPlatformBrandLegalSettingsCached = (
  brandId: string,
  options?: { force?: boolean },
) =>
  queryClient.fetchQuery({
    queryKey: queryKeys.platformBrandLegal(brandId),
    queryFn: () => getPlatformBrandLegalSettings(brandId),
    staleTime: resolveStaleTime(options?.force),
  });

export const fetchPlatformBrandDpaCached = (
  brandId: string,
  options?: { force?: boolean },
) =>
  queryClient.fetchQuery({
    queryKey: queryKeys.platformBrandDpa(brandId),
    queryFn: () => getPlatformBrandDpa(brandId),
    staleTime: resolveStaleTime(options?.force),
  });

export const fetchPlatformLocationConfigCached = (
  localId: string,
  options?: { force?: boolean },
) =>
  queryClient.fetchQuery({
    queryKey: queryKeys.platformLocationConfig(localId),
    queryFn: () => getPlatformLocationConfig(localId),
    staleTime: resolveStaleTime(options?.force),
  });
