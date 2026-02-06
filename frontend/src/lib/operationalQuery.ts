import { getAppointmentsByDateRange, getUsersByIds } from '@/data/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { getStoredLocalId } from '@/lib/tenant';

export const APPOINTMENTS_STALE_TIME = 30_000;
export const USERS_STALE_TIME = 60_000;

export const fetchAppointmentsByDateRangeCached = (
  dateFrom: string,
  dateTo: string,
  options?: { localId?: string | null; force?: boolean },
) => {
  const localId = options?.localId ?? getStoredLocalId();
  const staleTime = options?.force ? 0 : APPOINTMENTS_STALE_TIME;
  return queryClient.fetchQuery({
    queryKey: queryKeys.appointmentsRange(localId, dateFrom, dateTo),
    queryFn: () => getAppointmentsByDateRange(dateFrom, dateTo),
    staleTime,
  });
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
  return queryClient.fetchQuery({
    queryKey: queryKeys.usersByIds(localId, normalizedIds),
    queryFn: () => getUsersByIds(normalizedIds),
    staleTime,
  });
};
