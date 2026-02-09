import { getAppointmentsByDateRange } from '@/data/api/appointments';
import { getUsersByIds } from '@/data/api/users';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { getStoredLocalId } from '@/lib/tenant';

export const APPOINTMENTS_STALE_TIME = 30_000;
export const USERS_STALE_TIME = 60_000;

const hasFreshOperationalData = (queryKey: readonly unknown[], staleTime: number) => {
  if (staleTime <= 0) return false;
  const state = queryClient.getQueryState(queryKey);
  if (!state || state.data === undefined) return false;
  if (state.fetchStatus === "fetching") return false;
  if (state.isInvalidated) return false;
  return Date.now() - state.dataUpdatedAt < staleTime;
};

const resolveOperationalQuery = async <T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  staleTime: number,
) => {
  if (hasFreshOperationalData(queryKey, staleTime)) {
    const cached = queryClient.getQueryData<T>(queryKey);
    if (cached !== undefined) return cached;
  }

  const data = await queryFn();
  queryClient.setQueryData(queryKey, data);
  return data;
};

export const fetchAppointmentsByDateRangeCached = (
  dateFrom: string,
  dateTo: string,
  options?: { localId?: string | null; force?: boolean },
) => {
  const localId = options?.localId ?? getStoredLocalId();
  const staleTime = options?.force ? 0 : APPOINTMENTS_STALE_TIME;
  const queryKey = queryKeys.appointmentsRange(localId, dateFrom, dateTo);
  return resolveOperationalQuery(queryKey, () => getAppointmentsByDateRange(dateFrom, dateTo), staleTime);
};

export const fetchUsersByIdsCached = (
  ids: string[],
  options?: { localId?: string | null; force?: boolean },
) => {
  const localId = options?.localId ?? getStoredLocalId();
  const normalizedIds = Array.from(new Set(ids)).sort();
  const staleTime = options?.force ? 0 : USERS_STALE_TIME;
  if (normalizedIds.length === 0) {
    return Promise.resolve([]);
  }
  const queryKey = queryKeys.usersByIds(localId, normalizedIds);
  return resolveOperationalQuery(queryKey, () => getUsersByIds(normalizedIds), staleTime);
};
