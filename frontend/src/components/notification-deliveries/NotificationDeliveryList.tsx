import { Loader2, RotateCcw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  NotificationDeliveryChannel,
  NotificationDeliveryItem,
  NotificationDeliveryKind,
  NotificationDeliveryStatus,
} from '@/data/api/notificationDeliveries';
import { DeliveryColumnFilter, DeliveryFilterOption } from './DeliveryColumnFilter';
import {
  CHANNEL_LABELS,
  formatDeliveryDateTime,
  KIND_LABELS,
  STATUS_META,
} from './notificationDeliveryPresentation';
import { ChannelIcon, StatusIcon } from './NotificationDeliveryIcons';

export type DeliveryTableFilters = {
  status: NotificationDeliveryStatus | 'all';
  kind: NotificationDeliveryKind | 'all';
  channel: NotificationDeliveryChannel | 'all';
  brandId: string;
  localId: string;
};

type NotificationDeliveryListProps = {
  items: NotificationDeliveryItem[];
  filters: DeliveryTableFilters;
  channelOptions: DeliveryFilterOption[];
  brandOptions?: DeliveryFilterOption[];
  localOptions?: DeliveryFilterOption[];
  showTenant?: boolean;
  canRetry?: boolean;
  retryingId?: string | null;
  onFilterChange: <K extends keyof DeliveryTableFilters>(key: K, value: DeliveryTableFilters[K]) => void;
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

const RetryButton = ({
  item,
  retryingId,
  onRetry,
}: {
  item: NotificationDeliveryItem;
  retryingId?: string | null;
  onRetry?: (deliveryId: string) => void;
}) => {
  const retryable = item.status === 'failed' || item.status === 'skipped';
  if (!retryable || !onRetry) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={retryingId === item.id}
      onClick={() => onRetry(item.id)}
    >
      {retryingId === item.id
        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        : <RotateCcw className="mr-2 h-4 w-4" />}
      Reintentar
    </Button>
  );
};

const DeliveryDetails = ({ item }: { item: NotificationDeliveryItem }) => (
  <details className="mt-2 text-xs">
    <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">Ver diagnóstico</summary>
    <div className="mt-2 space-y-1 rounded-md border border-border/60 bg-muted/20 p-2 text-muted-foreground">
      <p>ID: <span className="font-mono text-foreground">{item.id}</span></p>
      <p>Proveedor: <span className="font-mono text-foreground">{item.providerMessageId || '-'}</span></p>
      <p>Intentos: <span className="text-foreground">{item.attemptCount} de {item.maxAttempts}</span></p>
      <p>Próximo intento: <span className="text-foreground">{formatDeliveryDateTime(item.nextAttemptAt)}</span></p>
      {item.attempts.map((attempt) => (
        <p key={attempt.id}>
          Intento {attempt.attemptNumber}: {attempt.status}{attempt.errorCode ? ` - ${attempt.errorCode}` : ''}
        </p>
      ))}
    </div>
  </details>
);

export const NotificationDeliveryList = ({
  items,
  filters,
  channelOptions,
  brandOptions = [],
  localOptions = [],
  showTenant = false,
  canRetry = false,
  retryingId,
  onFilterChange,
  onRetry,
}: NotificationDeliveryListProps) => (
  <>
    <div className="hidden overflow-x-auto rounded-lg border lg:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <span className="flex items-center gap-1">
                Método
                {channelOptions.length > 2 && (
                  <DeliveryColumnFilter
                    label="Método"
                    value={filters.channel}
                    options={channelOptions}
                    onChange={(value) => onFilterChange('channel', value as DeliveryTableFilters['channel'])}
                  />
                )}
              </span>
            </TableHead>
            <TableHead>
              <span className="flex items-center gap-1">
                Estado
                <DeliveryColumnFilter
                  label="Estado"
                  value={filters.status}
                  options={statusOptions}
                  onChange={(value) => onFilterChange('status', value as DeliveryTableFilters['status'])}
                />
              </span>
            </TableHead>
            <TableHead>
              <span className="flex items-center gap-1">
                Tipo
                <DeliveryColumnFilter
                  label="Tipo"
                  value={filters.kind}
                  options={kindOptions}
                  onChange={(value) => onFilterChange('kind', value as DeliveryTableFilters['kind'])}
                />
              </span>
            </TableHead>
            <TableHead>Destinatario y diagnóstico</TableHead>
            {showTenant && (
              <TableHead>
                <span className="flex items-center gap-1">
                  Tenant
                  <DeliveryColumnFilter
                    label="Tenant"
                    value={filters.brandId}
                    options={brandOptions}
                    onChange={(value) => onFilterChange('brandId', value)}
                  />
                </span>
              </TableHead>
            )}
            {showTenant && (
              <TableHead>
                <span className="flex items-center gap-1">
                  Local
                  <DeliveryColumnFilter
                    label="Local"
                    value={filters.localId}
                    options={localOptions}
                    onChange={(value) => onFilterChange('localId', value)}
                  />
                </span>
              </TableHead>
            )}
            <TableHead>Fecha</TableHead>
            {canRetry && <TableHead className="text-right">Acción</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <ChannelIcon channel={item.channel} />
                  {CHANNEL_LABELS[item.channel]}
                </span>
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <StatusIcon status={item.status} />
                  <Badge variant="outline" className={STATUS_META[item.status].className}>
                    {STATUS_META[item.status].label}
                  </Badge>
                </span>
              </TableCell>
              <TableCell>{KIND_LABELS[item.kind]}</TableCell>
              <TableCell className="min-w-64 max-w-md">
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.recipientName || 'Cliente'}{item.recipient ? ` - ${item.recipient}` : ''}
                </p>
                {(item.lastErrorCode || item.lastErrorMessage) && (
                  <div className="mt-2 rounded-md border border-destructive/20 bg-destructive/5 p-2 text-xs">
                    <p className="font-mono font-medium text-destructive">{item.lastErrorCode || 'NOTIFICATION_DELIVERY_FAILED'}</p>
                    {item.lastErrorMessage && <p className="mt-1 text-muted-foreground">{item.lastErrorMessage}</p>}
                  </div>
                )}
                <DeliveryDetails item={item} />
              </TableCell>
              {showTenant && <TableCell>{item.brandName}</TableCell>}
              {showTenant && <TableCell>{item.localName}</TableCell>}
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {formatDeliveryDateTime(item.createdAt)}
              </TableCell>
              {canRetry && <TableCell className="text-right"><RetryButton item={item} retryingId={retryingId} onRetry={onRetry} /></TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    <div className="space-y-3 lg:hidden">
      {items.map((item) => (
        <article key={item.id} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <ChannelIcon channel={item.channel} />
            <Badge variant="secondary">{CHANNEL_LABELS[item.channel]}</Badge>
            <StatusIcon status={item.status} />
            <Badge variant="outline" className={STATUS_META[item.status].className}>{STATUS_META[item.status].label}</Badge>
          </div>
          <h3 className="mt-3 font-medium">{item.title}</h3>
          <p className="text-sm text-muted-foreground">
            {item.recipientName || 'Cliente'}{item.recipient ? ` - ${item.recipient}` : ''}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {KIND_LABELS[item.kind]}{showTenant ? ` - ${item.brandName} - ${item.localName}` : ''}
          </p>
          {(item.lastErrorCode || item.lastErrorMessage) && (
            <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
              <p className="font-mono text-xs font-medium text-destructive">{item.lastErrorCode || 'NOTIFICATION_DELIVERY_FAILED'}</p>
              {item.lastErrorMessage && <p className="mt-1 text-muted-foreground">{item.lastErrorMessage}</p>}
            </div>
          )}
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{formatDeliveryDateTime(item.createdAt)}</p>
              <DeliveryDetails item={item} />
            </div>
            {canRetry && <RetryButton item={item} retryingId={retryingId} onRetry={onRetry} />}
          </div>
        </article>
      ))}
    </div>
  </>
);
