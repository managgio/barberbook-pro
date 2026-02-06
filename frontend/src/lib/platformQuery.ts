import {
  getPlatformBrand,
  getPlatformBrandAdmins,
  getPlatformBrandConfig,
  getPlatformBrandDpa,
  getPlatformBrandLegalSettings,
  getPlatformBrands,
  getPlatformLocationConfig,
} from '@/data/api/platform';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

export const PLATFORM_STALE_TIME = 60_000;

const resolveStaleTime = (force?: boolean) => (force ? 0 : PLATFORM_STALE_TIME);

const hasFreshPlatformData = (queryKey: readonly unknown[], staleTime: number) => {
  if (staleTime <= 0) return false;
  const state = queryClient.getQueryState(queryKey);
  if (!state || state.data === undefined) return false;
  return Date.now() - state.dataUpdatedAt < staleTime;
};

const resolvePlatformQuery = async <T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  staleTime: number,
) => {
  if (hasFreshPlatformData(queryKey, staleTime)) {
    const cached = queryClient.getQueryData<T>(queryKey);
    if (cached !== undefined) return cached;
  }

  const data = await queryFn();
  queryClient.setQueryData(queryKey, data);
  return data;
};

export const fetchPlatformBrandsCached = (options?: { force?: boolean }) =>
  resolvePlatformQuery(queryKeys.platformBrands(), getPlatformBrands, resolveStaleTime(options?.force));

export const fetchPlatformBrandCached = (
  brandId: string,
  options?: { force?: boolean },
) =>
  resolvePlatformQuery(
    queryKeys.platformBrand(brandId),
    () => getPlatformBrand(brandId),
    resolveStaleTime(options?.force),
  );

export const fetchPlatformBrandConfigCached = (
  brandId: string,
  options?: { force?: boolean },
) =>
  resolvePlatformQuery(
    queryKeys.platformBrandConfig(brandId),
    () => getPlatformBrandConfig(brandId),
    resolveStaleTime(options?.force),
  );

export const fetchPlatformBrandAdminsCached = (
  brandId: string,
  options?: { force?: boolean },
) =>
  resolvePlatformQuery(
    queryKeys.platformBrandAdmins(brandId),
    () => getPlatformBrandAdmins(brandId),
    resolveStaleTime(options?.force),
  );

export const fetchPlatformBrandLegalSettingsCached = (
  brandId: string,
  options?: { force?: boolean },
) =>
  resolvePlatformQuery(
    queryKeys.platformBrandLegal(brandId),
    () => getPlatformBrandLegalSettings(brandId),
    resolveStaleTime(options?.force),
  );

export const fetchPlatformBrandDpaCached = (
  brandId: string,
  options?: { force?: boolean },
) =>
  resolvePlatformQuery(
    queryKeys.platformBrandDpa(brandId),
    () => getPlatformBrandDpa(brandId),
    resolveStaleTime(options?.force),
  );

export const fetchPlatformLocationConfigCached = (
  localId: string,
  options?: { force?: boolean },
) =>
  resolvePlatformQuery(
    queryKeys.platformLocationConfig(localId),
    () => getPlatformLocationConfig(localId),
    resolveStaleTime(options?.force),
  );
