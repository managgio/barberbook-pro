import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { getAvailableDays } from '@/data/api/appointments';
import { queryKeys } from '@/lib/queryKeys';

export const useBookingAvailableDays = ({
  localId,
  visibleMonth,
  serviceIds,
  barberIds,
  enabled,
  isStaffLoading = false,
}: {
  localId: string | null | undefined;
  visibleMonth: Date;
  serviceIds: string[];
  barberIds: string[];
  enabled: boolean;
  isStaffLoading?: boolean;
}) => {
  const dateFrom = format(
    startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 }),
    'yyyy-MM-dd',
  );
  const dateTo = format(
    endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 }),
    'yyyy-MM-dd',
  );
  const calendarDays = useMemo(
    () =>
      eachDayOfInterval({
        start: new Date(`${dateFrom}T00:00:00`),
        end: new Date(`${dateTo}T00:00:00`),
      }),
    [dateFrom, dateTo],
  );
  const serviceIdsKey = [...new Set(serviceIds)].sort().join(',');
  const barberIdsKey = [...new Set(barberIds)].sort().join(',');
  const query = useQuery({
    queryKey: queryKeys.bookingAvailableDays(
      localId,
      dateFrom,
      dateTo,
      serviceIdsKey,
      barberIdsKey,
    ),
    enabled:
      enabled &&
      !isStaffLoading &&
      Boolean(localId && serviceIdsKey && barberIdsKey),
    staleTime: 15_000,
    refetchOnMount: 'always',
    retry: false,
    queryFn: ({ signal }) =>
      getAvailableDays(
        dateFrom,
        dateTo,
        barberIdsKey.split(','),
        serviceIdsKey.split(','),
        signal,
      ),
  });
  const availableDays = useMemo(() => new Set(query.data ?? []), [query.data]);
  const isLoading =
    enabled &&
    (isStaffLoading ||
      (Boolean(serviceIdsKey && barberIdsKey) &&
        (query.isPending || query.isFetching)));
  const isReady = enabled && !isLoading && query.isSuccess;
  return {
    calendarDays,
    availableDays,
    isLoading,
    isReady,
    isError: query.isError,
    refetch: query.refetch,
  };
};
