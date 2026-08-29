import { Loader2, RefreshCcw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  NotificationDeliveryChannel,
  NotificationDeliveryHistory,
  NotificationDeliveryKind,
  NotificationDeliveryStatus,
} from '@/data/api/notificationDeliveries';
import { DeliveryColumnFilter, DeliveryFilterOption } from './DeliveryColumnFilter';
import { DeliveryTableFilters, NotificationDeliveryList } from './NotificationDeliveryList';
import { CHANNEL_LABELS, KIND_LABELS, STATUS_META } from './notificationDeliveryPresentation';

export type NotificationDeliveryHistoryPanelProps = {
  title?: string;
  description?: string;
  data?: NotificationDeliveryHistory;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
  filters: DeliveryTableFilters;
  brandOptions?: DeliveryFilterOption[];
  localOptions?: DeliveryFilterOption[];
  showTenant?: boolean;
  canRetry?: boolean;
  retryingId?: string | null;
  onFilterChange: <K extends keyof DeliveryTableFilters>(key: K, value: DeliveryTableFilters[K]) => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onRetry?: (deliveryId: string) => void;
};

const statusOptions: DeliveryFilterOption[] = [
  { value: 'all', label: 'Todas las incidencias' },
  ...(['failed', 'retrying', 'pending', 'processing', 'skipped'] as NotificationDeliveryStatus[])
    .map((value) => ({ value, label: STATUS_META[value].label })),
];
const kindOptions: DeliveryFilterOption[] = [
  { value: 'all', label: 'Todos los tipos' },
  ...Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label })),
];

export const NotificationDeliveryHistoryPanel = ({
  title = 'Incidencias de envíos',
  description = 'Mensajes que requieren atención o que el sistema está reintentando.',
  data,
  isLoading,
  isFetching,
  error,
  filters,
  brandOptions = [],
  localOptions = [],
  showTenant = false,
  canRetry = false,
  retryingId,
  onFilterChange,
  onPageChange,
  onRefresh,
  onRetry,
}: NotificationDeliveryHistoryPanelProps) => {
  const enabledChannels = data?.enabledChannels || [];
  const channelOptions: DeliveryFilterOption[] = [
    { value: 'all', label: 'Todos los métodos' },
    ...enabledChannels.map((value) => ({ value, label: CHANNEL_LABELS[value] })),
  ];
  const resetPageAndFilter = <K extends keyof DeliveryTableFilters>(key: K, value: DeliveryTableFilters[K]) => {
    onPageChange(1);
    onFilterChange(key, value);
  };

  return (
    <Card className="min-w-0">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={isFetching}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:hidden">
          <span className="text-xs font-medium text-muted-foreground">Filtros:</span>
          {channelOptions.length > 2 && (
            <span className="flex items-center rounded-md border pl-2 text-xs">
              Método
              <DeliveryColumnFilter
                label="Método"
                value={filters.channel}
                options={channelOptions}
                onChange={(value) => resetPageAndFilter('channel', value as NotificationDeliveryChannel | 'all')}
              />
            </span>
          )}
          <span className="flex items-center rounded-md border pl-2 text-xs">
            Estado
            <DeliveryColumnFilter
              label="Estado"
              value={filters.status}
              options={statusOptions}
              onChange={(value) => resetPageAndFilter('status', value as NotificationDeliveryStatus | 'all')}
            />
          </span>
          <span className="flex items-center rounded-md border pl-2 text-xs">
            Tipo
            <DeliveryColumnFilter
              label="Tipo"
              value={filters.kind}
              options={kindOptions}
              onChange={(value) => resetPageAndFilter('kind', value as NotificationDeliveryKind | 'all')}
            />
          </span>
          {showTenant && (
            <span className="flex items-center rounded-md border pl-2 text-xs">
              Tenant
              <DeliveryColumnFilter
                label="Tenant"
                value={filters.brandId}
                options={brandOptions}
                onChange={(value) => resetPageAndFilter('brandId', value)}
              />
            </span>
          )}
          {showTenant && (
            <span className="flex items-center rounded-md border pl-2 text-xs">
              Local
              <DeliveryColumnFilter
                label="Local"
                value={filters.localId}
                options={localOptions}
                onChange={(value) => resetPageAndFilter('localId', value)}
              />
            </span>
          )}
        </div>

        {data && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Incidencias: {data.total}</Badge>
            <Badge variant="outline" className={STATUS_META.failed.className}>Fallidos: {data.counts.failed || 0}</Badge>
            <Badge variant="outline" className={STATUS_META.retrying.className}>Reintentando: {data.counts.retrying || 0}</Badge>
            <Badge variant="outline" className={STATUS_META.pending.className}>Pendientes: {data.counts.pending || 0}</Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
          Los envíos aceptados se conservan temporalmente para diagnóstico, pero esta vista prioriza únicamente incidencias. Una aceptación del proveedor no confirma la lectura del mensaje.
        </p>
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            No se pudieron cargar las incidencias de envío. Inténtalo de nuevo.
          </div>
        ) : isLoading ? (
          <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : data?.items.length ? (
          <NotificationDeliveryList
            items={data.items}
            filters={filters}
            channelOptions={channelOptions}
            brandOptions={brandOptions}
            localOptions={localOptions}
            showTenant={showTenant}
            canRetry={canRetry}
            retryingId={retryingId}
            onFilterChange={resetPageAndFilter}
            onRetry={onRetry}
          />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No hay incidencias con estos filtros.</p>
        )}
        {data && data.totalPages > 1 && (
          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Página {data.page} de {data.totalPages} - {data.pageSize} resultados por página
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={data.page <= 1 || isFetching} onClick={() => onPageChange(data.page - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={data.page >= data.totalPages || isFetching} onClick={() => onPageChange(data.page + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
