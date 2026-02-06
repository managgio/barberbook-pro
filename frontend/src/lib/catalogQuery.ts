import { getBarbers } from "@/data/api/barbers";
import { getProductCategories } from "@/data/api/product-categories";
import { getAdminProducts, getProducts } from "@/data/api/products";
import { getServiceCategories } from "@/data/api/service-categories";
import { getServices } from "@/data/api/services";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { getStoredLocalId } from "@/lib/tenant";

export const CATALOG_STALE_TIME = 2 * 60_000;

const hasFreshCatalogData = (queryKey: readonly unknown[], staleTime: number) => {
  if (staleTime <= 0) return false;
  const state = queryClient.getQueryState(queryKey);
  if (!state || state.data === undefined) return false;
  return Date.now() - state.dataUpdatedAt < staleTime;
};

const resolveCatalogQuery = async <T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  staleTime: number,
) => {
  if (hasFreshCatalogData(queryKey, staleTime)) {
    const cached = queryClient.getQueryData<T>(queryKey);
    if (cached !== undefined) return cached;
  }

  const data = await queryFn();
  queryClient.setQueryData(queryKey, data);
  return data;
};

export const fetchServicesCached = (options?: {
  includeArchived?: boolean;
  localId?: string | null;
  force?: boolean;
}) => {
  const includeArchived = options?.includeArchived ?? false;
  const localId = options?.localId ?? getStoredLocalId();
  const staleTime = options?.force ? 0 : CATALOG_STALE_TIME;
  const queryKey = queryKeys.services(localId, includeArchived);
  return resolveCatalogQuery(queryKey, () => getServices({ includeArchived }), staleTime);
};

export const fetchBarbersCached = (options?: {
  serviceId?: string;
  localId?: string | null;
  force?: boolean;
}) => {
  const localId = options?.localId ?? getStoredLocalId();
  const serviceId = options?.serviceId;
  const staleTime = options?.force ? 0 : CATALOG_STALE_TIME;
  const queryKey = queryKeys.barbers(localId, serviceId);
  return resolveCatalogQuery(queryKey, () => getBarbers(serviceId ? { serviceId } : undefined), staleTime);
};

export const fetchServiceCategoriesCached = (options?: {
  withServices?: boolean;
  localId?: string | null;
  force?: boolean;
}) => {
  const withServices = options?.withServices ?? true;
  const localId = options?.localId ?? getStoredLocalId();
  const staleTime = options?.force ? 0 : CATALOG_STALE_TIME;
  const queryKey = queryKeys.serviceCategories(localId, withServices);
  return resolveCatalogQuery(queryKey, () => getServiceCategories(withServices), staleTime);
};

export const fetchProductsCached = (options?: {
  context?: "booking" | "landing";
  localId?: string | null;
  force?: boolean;
}) => {
  const context = options?.context ?? "booking";
  const localId = options?.localId ?? getStoredLocalId();
  const staleTime = options?.force ? 0 : CATALOG_STALE_TIME;
  const queryKey = queryKeys.products(localId, context);
  return resolveCatalogQuery(queryKey, () => getProducts(context), staleTime);
};

export const fetchAdminProductsCached = (options?: { localId?: string | null; force?: boolean }) => {
  const localId = options?.localId ?? getStoredLocalId();
  const staleTime = options?.force ? 0 : CATALOG_STALE_TIME;
  const queryKey = queryKeys.adminProducts(localId);
  return resolveCatalogQuery(queryKey, getAdminProducts, staleTime);
};

export const fetchProductCategoriesCached = (options?: {
  withProducts?: boolean;
  localId?: string | null;
  force?: boolean;
}) => {
  const withProducts = options?.withProducts ?? true;
  const localId = options?.localId ?? getStoredLocalId();
  const staleTime = options?.force ? 0 : CATALOG_STALE_TIME;
  const queryKey = queryKeys.productCategories(localId, withProducts);
  return resolveCatalogQuery(queryKey, () => getProductCategories(withProducts), staleTime);
};
