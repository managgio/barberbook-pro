import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { NotificationDeliveryHistoryPanel } from '@/components/notification-deliveries/NotificationDeliveryHistoryPanel';
import type { DeliveryTableFilters } from '@/components/notification-deliveries/NotificationDeliveryList';
import {
  getTenantNotificationDeliveries,
  retryTenantNotificationDelivery,
} from '@/data/api/notificationDeliveries';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/queryKeys';

const PAGE_SIZE = 25;
const initialFilters: DeliveryTableFilters = {
  status: 'all',
  kind: 'all',
  channel: 'all',
  brandId: 'all',
  localId: 'all',
};

const AdminNotificationDeliveries = () => {
  const { currentLocationId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<DeliveryTableFilters>(initialFilters);

  useEffect(() => {
    setPage(1);
    setFilters(initialFilters);
  }, [currentLocationId]);

  const queryKey = queryKeys.adminNotificationDeliveries(currentLocationId, page, filters);
  const historyQuery = useQuery({
    queryKey,
    queryFn: () => getTenantNotificationDeliveries({
      page,
      pageSize: PAGE_SIZE,
      status: filters.status === 'all' ? undefined : filters.status,
      kind: filters.kind === 'all' ? undefined : filters.kind,
      channel: filters.channel === 'all' ? undefined : filters.channel,
    }),
    staleTime: 15_000,
  });

  useEffect(() => {
    const enabled = historyQuery.data?.enabledChannels;
    if (enabled && filters.channel !== 'all' && !enabled.includes(filters.channel)) {
      setFilters((current) => ({ ...current, channel: 'all' }));
      setPage(1);
    }
  }, [filters.channel, historyQuery.data?.enabledChannels]);

  const retryMutation = useMutation({
    mutationFn: retryTenantNotificationDelivery,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['notification-deliveries', currentLocationId || 'default'] });
      toast({
        title: result.success ? 'Reintento iniciado' : 'No se pudo reintentar',
        description: result.success
          ? 'El sistema ha vuelto a procesar el envío.'
          : 'La entrega ya no está en un estado reintentable o el método está deshabilitado.',
        variant: result.success ? 'default' : 'destructive',
      });
    },
    onError: () => toast({
      title: 'No se pudo reintentar',
      description: 'Actualiza las incidencias y vuelve a intentarlo.',
      variant: 'destructive',
    }),
  });

  const handleFilterChange = <K extends keyof DeliveryTableFilters>(key: K, value: DeliveryTableFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Incidencias de envíos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Revisa los fallos de correo, SMS y WhatsApp habilitados para este local, junto con sus reintentos y diagnóstico.
        </p>
      </header>
      <NotificationDeliveryHistoryPanel
        data={historyQuery.data}
        isLoading={historyQuery.isLoading}
        isFetching={historyQuery.isFetching}
        error={historyQuery.error}
        filters={filters}
        canRetry
        retryingId={retryMutation.isPending ? retryMutation.variables : null}
        onFilterChange={handleFilterChange}
        onPageChange={setPage}
        onRefresh={() => void historyQuery.refetch()}
        onRetry={(deliveryId) => retryMutation.mutate(deliveryId)}
      />
    </section>
  );
};

export default AdminNotificationDeliveries;
