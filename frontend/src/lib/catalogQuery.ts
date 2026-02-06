import {
  getAdminProducts,
  getBarbers,
  getProductCategories,
  getProducts,
  getServiceCategories,
  getServices,
} from "@/data/api";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { getStoredLocalId } from "@/lib/tenant";

export const CATALOG_STALE_TIME = 2 * 60_000;

export const fetchServicesCached = (options?: {
  includeArchived?: boolean;
  localId?: string | null;
  force?: boolean;
}) => {
  const includeArchived = options?.includeArchived ?? false;
  const localId = options?.localId ?? getStoredLocalId();
  const staleTime = options?.force ? 0 : CATALOG_STALE_TIME;
  return queryClient.fetchQuery({
    queryKey: queryKeys.services(localId, includeArchived),
    queryFn: () => getServices({ includeArchived }),
    staleTime,
  });
};

export const fetchBarbersCached = (options?: {
  serviceId?: string;
  localId?: string | null;
  force?: boolean;
}) => {
  const localId = options?.localId ?? getStoredLocalId();
  const serviceId = options?.serviceId;
  const staleTime = options?.force ? 0 : CATALOG_STALE_TIME;
  return queryClient.fetchQuery({
    queryKey: queryKeys.barbers(localId, serviceId),
    queryFn: () => getBarbers(serviceId ? { serviceId } : undefined),
    staleTime,
  });
};

export const fetchServiceCategoriesCached = (options?: {
  withServices?: boolean;
  localId?: string | null;
  force?: boolean;
}) => {
  const withServices = options?.withServices ?? true;
  const localId = options?.localId ?? getStoredLocalId();
  const staleTime = options?.force ? 0 : CATALOG_STALE_TIME;
  return queryClient.fetchQuery({
    queryKey: queryKeys.serviceCategories(localId, withServices),
    queryFn: () => getServiceCategories(withServices),
    staleTime,
  });
};

export const fetchProductsCached = (options?: {
  context?: "booking" | "landing";
  localId?: string | null;
  force?: boolean;
}) => {
  const context = options?.context ?? "booking";
  const localId = options?.localId ?? getStoredLocalId();
  const staleTime = options?.force ? 0 : CATALOG_STALE_TIME;
  return queryClient.fetchQuery({
    queryKey: queryKeys.products(localId, context),
    queryFn: () => getProducts(context),
    staleTime,
  });
};

export const fetchAdminProductsCached = (options?: { localId?: string | null; force?: boolean }) => {
  const localId = options?.localId ?? getStoredLocalId();
  const staleTime = options?.force ? 0 : CATALOG_STALE_TIME;
  return queryClient.fetchQuery({
    queryKey: queryKeys.adminProducts(localId),
    queryFn: getAdminProducts,
    staleTime,
  });
};

export const fetchProductCategoriesCached = (options?: {
  withProducts?: boolean;
  localId?: string | null;
  force?: boolean;
}) => {
  const withProducts = options?.withProducts ?? true;
  const localId = options?.localId ?? getStoredLocalId();
  const staleTime = options?.force ? 0 : CATALOG_STALE_TIME;
  return queryClient.fetchQuery({
    queryKey: queryKeys.productCategories(localId, withProducts),
    queryFn: () => getProductCategories(withProducts),
    staleTime,
  });
};
