import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, CircleHelp, PauseCircle, PlayCircle, RefreshCcw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  getPlatformApiMetricsSummary,
  getPlatformI18nObservabilitySummary,
  pausePlatformTenantAutoTranslate,
  resumePlatformTenantAutoTranslate,
  getPlatformWebVitalsSummary,
} from '@/data/api/observability';
import {
  PlatformObservabilityApiRouteSummary,
  PlatformObservabilityApiSummary,
  PlatformI18nObservabilitySummary,
  PlatformI18nTenantStatus,
  PlatformObservabilityWebVitalMetricSummary,
  PlatformObservabilityWebVitalsSummary,
} from '@/data/types';
import { isApiRequestError } from '@/lib/networkErrors';
import { queryKeys } from '@/lib/queryKeys';

const WINDOWS = [
  { label: '60 min', value: 60 },
  { label: '24 h', value: 1_440 },
  { label: '7 días', value: 10_080 },
] as const;

const CRITICAL_WEB_VITALS = new Set(['LCP', 'INP', 'CLS']);
const WEB_VITAL_LEGEND = [
  { name: 'LCP', description: 'Tiempo de carga del contenido principal visible.' },
  { name: 'INP', description: 'Tiempo de respuesta de la interfaz ante interacción.' },
  { name: 'CLS', description: 'Estabilidad visual; evita saltos inesperados de layout.' },
  { name: 'FCP', description: 'Momento en que aparece el primer contenido en pantalla.' },
  { name: 'TTFB', description: 'Tiempo hasta recibir el primer byte de respuesta del servidor.' },
] as const;

const formatMs = (value: number) => `${value.toFixed(0)} ms`;
const formatPct = (value: number) => `${value.toFixed(2)}%`;
const formatInteger = (value: number) => value.toLocaleString('es-ES');

type HealthLevel = 'ok' | 'warning' | 'critical';

const HEALTH_PRIORITY: Record<HealthLevel, number> = {
  critical: 0,
  warning: 1,
  ok: 2,
};

const getHealthMeta = (level: HealthLevel) => {
  if (level === 'critical') {
    return {
      label: 'Crítico',
      badgeClassName: 'border-destructive/40 bg-destructive/10 text-destructive',
      rowClassName: 'bg-destructive/5',
    };
  }
  if (level === 'warning') {
    return {
      label: 'Vigilar',
      badgeClassName: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
      rowClassName: 'bg-amber-500/5',
    };
  }
  return {
    label: 'OK',
    badgeClassName: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    rowClassName: '',
  };
};

const getWebVitalHealth = (row: PlatformObservabilityWebVitalMetricSummary): HealthLevel => {
  if (row.ratings.poor > 0) return 'critical';
  if (row.ratings.needsImprovement > 0) return 'warning';
  return 'ok';
};

const getApiHealth = (row: PlatformObservabilityApiRouteSummary): HealthLevel => {
  const has5xx = row.statuses.some((status) => status.status >= 500);
  if (has5xx || row.errorRate >= 5 || row.p95DurationMs >= 2_000) return 'critical';
  if (row.errorRate >= 1 || row.p95DurationMs >= 1_000) return 'warning';
  return 'ok';
};

const getI18nStatusMeta = (status: PlatformI18nTenantStatus) => {
  if (status === 'critical') {
    return {
      label: 'Crítico',
      badgeClassName: 'border-destructive/40 bg-destructive/10 text-destructive',
    };
  }
  if (status === 'paused') {
    return {
      label: 'Pausado',
      badgeClassName: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
    };
  }
  if (status === 'warning') {
    return {
      label: 'Vigilar',
      badgeClassName: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    };
  }
  return {
    label: 'OK',
    badgeClassName: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  };
};

const buildHealthSummary = <T,>(rows: T[], resolver: (row: T) => HealthLevel) =>
  rows.reduce(
    (acc, row) => {
      const level = resolver(row);
      acc[level] += 1;
      return acc;
    },
    { critical: 0, warning: 0, ok: 0 },
  );

const getErrorMessage = (error: unknown) => {
  if (!isApiRequestError(error)) {
    return 'No se pudieron cargar los datos ahora mismo. Revisa la conexión e inténtalo de nuevo.';
  }
  if (error.kind === 'OFFLINE') {
    return 'Estás sin conexión. Reconecta internet y pulsa "Actualizar".';
  }
  if (error.kind === 'TIMEOUT') {
    return 'La consulta tardó demasiado. Puede haber alta carga en el servidor.';
  }
  if (error.kind === 'NETWORK') {
    return 'No se pudo contactar con la API. Verifica backend/proxy y vuelve a intentar.';
  }
  if (error.kind === 'HTTP' && error.status >= 500) {
    return 'La API devolvió un error del servidor. Revisa logs de backend.';
  }
  if (error.kind === 'HTTP' && (error.status === 401 || error.status === 403)) {
    return 'Tu sesión no tiene permisos de plataforma o ha expirado.';
  }
  return error.message || 'Error inesperado al cargar observabilidad.';
};

const CardInfoTooltip: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        aria-label={label}
      >
        <CircleHelp className="h-4 w-4" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
      {children}
    </TooltipContent>
  </Tooltip>
);

const MetricLabelWithTooltip: React.FC<{
  label: string;
  tooltip: React.ReactNode;
}> = ({ label, tooltip }) => (
  <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
    <span>{label}</span>
    <CardInfoTooltip label={`Info ${label}`}>{tooltip}</CardInfoTooltip>
  </div>
);

const WebVitalsTable: React.FC<{ rows: PlatformObservabilityWebVitalMetricSummary[] }> = ({ rows }) => {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay muestras de Web Vitals para esta ventana.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Estado</TableHead>
          <TableHead>Métrica</TableHead>
          <TableHead>Promedio</TableHead>
          <TableHead>P95</TableHead>
          <TableHead>Muestras</TableHead>
          <TableHead>Poor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const health = getWebVitalHealth(row);
          const meta = getHealthMeta(health);
          return (
            <TableRow key={row.name} className={meta.rowClassName}>
              <TableCell>
                <Badge variant="outline" className={meta.badgeClassName}>
                  {meta.label}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{row.name}</span>
                  {CRITICAL_WEB_VITALS.has(row.name) && <Badge variant="secondary">Crítica</Badge>}
                </div>
              </TableCell>
              <TableCell>{row.name === 'CLS' ? row.avg.toFixed(3) : formatMs(row.avg)}</TableCell>
              <TableCell>{row.name === 'CLS' ? row.p95.toFixed(3) : formatMs(row.p95)}</TableCell>
              <TableCell>{row.count}</TableCell>
              <TableCell className={row.ratings.poor > 0 ? 'text-destructive font-medium' : ''}>{row.ratings.poor}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

const ApiTable: React.FC<{ rows: PlatformObservabilityApiRouteSummary[] }> = ({ rows }) => {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay tráfico de API registrado para esta ventana.</p>;
  }

  return (
    <Table className="min-w-[980px]">
      <TableHeader>
        <TableRow>
          <TableHead>Estado</TableHead>
          <TableHead>Ruta</TableHead>
          <TableHead>Subdominio</TableHead>
          <TableHead>Latencia media</TableHead>
          <TableHead>P95</TableHead>
          <TableHead>Error ratio</TableHead>
          <TableHead>Hits</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const health = getApiHealth(row);
          const meta = getHealthMeta(health);
          const stableKey = `${row.method}-${row.route}-${row.subdomain ?? 'none'}-${index}`;
          return (
            <TableRow key={stableKey} className={meta.rowClassName}>
              <TableCell>
                <Badge variant="outline" className={meta.badgeClassName}>
                  {meta.label}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs sm:text-sm whitespace-nowrap">{row.method} {row.route}</TableCell>
              <TableCell>{row.subdomain || 'sin subdominio'}</TableCell>
              <TableCell>{formatMs(row.avgDurationMs)}</TableCell>
              <TableCell>{formatMs(row.p95DurationMs)}</TableCell>
              <TableCell className={row.errorRate >= 1 ? 'text-destructive font-medium' : ''}>{formatPct(row.errorRate)}</TableCell>
              <TableCell>{row.count}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

const I18nTenantsTable: React.FC<{
  data: PlatformI18nObservabilitySummary;
  showIssuesOnly: boolean;
  actionBrandId: string | null;
  onTogglePaused: (brandId: string, paused: boolean) => void;
}> = ({ data, showIssuesOnly, actionBrandId, onTogglePaused }) => {
  const rows = showIssuesOnly
    ? data.tenants.filter((tenant) => tenant.status !== 'ok')
    : data.tenants;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {showIssuesOnly
          ? 'No hay tenants con alertas en esta ventana.'
          : 'No hay datos i18n suficientes todavía para mostrar detalle por tenant.'}
      </p>
    );
  }

  return (
    <Table className="min-w-[1100px]">
      <TableHeader>
        <TableRow>
          <TableHead>
            <div className="flex items-center gap-1">
              <span>Tenant</span>
              <CardInfoTooltip label="Info tenant">
                Marca/cliente que estás monitorizando en esta fila.
              </CardInfoTooltip>
            </div>
          </TableHead>
          <TableHead>
            <div className="flex items-center gap-1">
              <span>Estado</span>
              <CardInfoTooltip label="Info estado">
                Salud operativa de traducciones para ese tenant: OK, Vigilar, Crítico o Pausado.
              </CardInfoTooltip>
            </div>
          </TableHead>
          <TableHead>
            <div className="flex items-center gap-1">
              <span>Cola</span>
              <CardInfoTooltip label="Info cola">
                Traducciones pendientes de procesar.
              </CardInfoTooltip>
            </div>
          </TableHead>
          <TableHead>
            <div className="flex items-center gap-1">
              <span>Fallos (ventana)</span>
              <CardInfoTooltip label="Info fallos ventana">
                Ratio de fallos de traducción automática en la ventana temporal seleccionada.
              </CardInfoTooltip>
            </div>
          </TableHead>
          <TableHead>
            <div className="flex items-center gap-1">
              <span>Uso mensual</span>
              <CardInfoTooltip label="Info uso mensual">
                Consumo del mes en peticiones/caracteres frente al límite configurado (si existe).
              </CardInfoTooltip>
            </div>
          </TableHead>
          <TableHead className="text-right">Acción</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((tenant) => {
          const statusMeta = getI18nStatusMeta(tenant.status);
          const requestPct = tenant.monthlyRequests.ratio !== null
            ? Math.min(100, Math.round(tenant.monthlyRequests.ratio * 100))
            : null;
          const characterPct = tenant.monthlyCharacters.ratio !== null
            ? Math.min(100, Math.round(tenant.monthlyCharacters.ratio * 100))
            : null;
          const failurePct = tenant.failureWindow.totalSamples > 0
            ? tenant.failureWindow.failureRate * 100
            : 0;
          const isActioning = actionBrandId === tenant.brandId;

          return (
            <TableRow key={tenant.brandId}>
              <TableCell>
                <div className="space-y-1">
                  <div className="font-medium leading-tight">{tenant.brandName}</div>
                  <div className="text-xs text-muted-foreground">
                    {tenant.subdomain}.managgio • {tenant.languages.defaultLanguage.toUpperCase()} •{' '}
                    {tenant.languages.supportedCount} idioma{tenant.languages.supportedCount === 1 ? '' : 's'}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <Badge variant="outline" className={statusMeta.badgeClassName}>
                    {statusMeta.label}
                  </Badge>
                  {!tenant.autoTranslateEnabled && (
                    <div className="text-[11px] text-muted-foreground">Auto-traducción desactivada</div>
                  )}
                  {tenant.paused && tenant.pauseReason && (
                    <div className="text-[11px] text-muted-foreground line-clamp-2">
                      {tenant.pauseReason}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="text-sm font-semibold">{formatInteger(tenant.queue.pending)}</div>
                  <div className="text-[11px] text-muted-foreground">pendientes</div>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className={`text-sm font-medium ${tenant.failureWindow.highFailure ? 'text-destructive' : ''}`}>
                    {tenant.failureWindow.failedSamples}/{tenant.failureWindow.totalSamples} ({failurePct.toFixed(1)}%)
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    umbral {Math.round(tenant.failureWindow.threshold * 100)}% • mín {tenant.failureWindow.minSamples}
                  </div>
                </div>
              </TableCell>
              <TableCell className="space-y-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={tenant.monthlyRequests.overLimit ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                      Peticiones
                    </span>
                    <span className={tenant.monthlyRequests.overLimit ? 'text-destructive font-semibold' : 'text-foreground'}>
                      {formatInteger(tenant.monthlyRequests.used)}
                      {tenant.monthlyRequests.limit ? ` / ${formatInteger(tenant.monthlyRequests.limit)}` : ' / sin límite'}
                    </span>
                  </div>
                  {requestPct !== null && <Progress value={requestPct} className="h-1.5" />}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={tenant.monthlyCharacters.overLimit ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                      Caracteres
                    </span>
                    <span className={tenant.monthlyCharacters.overLimit ? 'text-destructive font-semibold' : 'text-foreground'}>
                      {formatInteger(tenant.monthlyCharacters.used)}
                      {tenant.monthlyCharacters.limit ? ` / ${formatInteger(tenant.monthlyCharacters.limit)}` : ' / sin límite'}
                    </span>
                  </div>
                  {characterPct !== null && <Progress value={characterPct} className="h-1.5" />}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant={tenant.paused ? 'default' : 'outline'}
                  disabled={isActioning}
                  onClick={() => onTogglePaused(tenant.brandId, tenant.paused)}
                >
                  {tenant.paused ? <PlayCircle className="mr-2 h-4 w-4" /> : <PauseCircle className="mr-2 h-4 w-4" />}
                  {tenant.paused ? 'Reanudar' : 'Pausar'}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

const PlatformObservability: React.FC = () => {
  const [windowMinutes, setWindowMinutes] = useState<number>(60);
  const [showIssuesOnly, setShowIssuesOnly] = useState<boolean>(true);

  const webVitalsQuery = useQuery<PlatformObservabilityWebVitalsSummary>({
    queryKey: queryKeys.platformObservabilityWebVitals(windowMinutes),
    queryFn: () => getPlatformWebVitalsSummary(windowMinutes),
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });

  const apiQuery = useQuery<PlatformObservabilityApiSummary>({
    queryKey: queryKeys.platformObservabilityApi(windowMinutes),
    queryFn: () => getPlatformApiMetricsSummary(windowMinutes),
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });

  const i18nQuery = useQuery<PlatformI18nObservabilitySummary>({
    queryKey: queryKeys.platformObservabilityI18n(windowMinutes),
    queryFn: () => getPlatformI18nObservabilitySummary(windowMinutes),
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });

  const i18nActionMutation = useMutation({
    mutationFn: async (params: { brandId: string; currentlyPaused: boolean }) => {
      if (params.currentlyPaused) {
        return resumePlatformTenantAutoTranslate(params.brandId);
      }
      return pausePlatformTenantAutoTranslate(params.brandId);
    },
    onSuccess: async () => {
      await i18nQuery.refetch();
    },
  });

  const isRefreshing = webVitalsQuery.isFetching || apiQuery.isFetching || i18nQuery.isFetching;

  const webVitalRows = useMemo(
    () =>
      (webVitalsQuery.data?.byMetric || [])
        .slice()
        .sort((a, b) => {
          const healthDiff = HEALTH_PRIORITY[getWebVitalHealth(a)] - HEALTH_PRIORITY[getWebVitalHealth(b)];
          if (healthDiff !== 0) return healthDiff;
          return b.count - a.count;
        }),
    [webVitalsQuery.data?.byMetric],
  );
  const apiRows = useMemo(
    () =>
      (apiQuery.data?.topRoutes || [])
        .slice()
        .sort((a, b) => {
          const healthDiff = HEALTH_PRIORITY[getApiHealth(a)] - HEALTH_PRIORITY[getApiHealth(b)];
          if (healthDiff !== 0) return healthDiff;
          return b.count - a.count;
        })
        .slice(0, 20),
    [apiQuery.data?.topRoutes],
  );
  const webVitalsHealth = useMemo(() => buildHealthSummary(webVitalRows, getWebVitalHealth), [webVitalRows]);
  const apiHealth = useMemo(() => buildHealthSummary(apiRows, getApiHealth), [apiRows]);
  const i18nSummary = i18nQuery.data?.summary;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Observabilidad</h1>
          <p className="text-sm text-muted-foreground">
            Vista rápida de experiencia de usuario y salud de API para plataforma.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(windowMinutes)} onValueChange={(value) => setWindowMinutes(Number(value))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Ventana" />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => {
              void Promise.all([webVitalsQuery.refetch(), apiQuery.refetch(), i18nQuery.refetch()]);
            }}
            disabled={isRefreshing}
          >
            <RefreshCcw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex min-w-0 max-h-[calc(100vh-10rem)] flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Experiencia (Web Vitals)
              <CardInfoTooltip label="Qué muestra esta card de experiencia">
                Resume la calidad real de la experiencia en cada ruta: tiempos de carga, respuesta y estabilidad
                visual. Prioriza filas con más impacto para que detectes rápido degradaciones UX.
              </CardInfoTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4 overflow-y-auto overflow-x-hidden">
            {webVitalsQuery.error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  No se pudo cargar Web Vitals
                </div>
                <p className="mt-1">{getErrorMessage(webVitalsQuery.error)}</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>Eventos: <strong className="text-foreground">{webVitalsQuery.data?.totalEvents ?? 0}</strong></span>
                  <span>Ventana: <strong className="text-foreground">{webVitalsQuery.data?.windowMinutes ?? windowMinutes} min</strong></span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className={getHealthMeta('critical').badgeClassName}>Crítico: {webVitalsHealth.critical}</Badge>
                  <Badge variant="outline" className={getHealthMeta('warning').badgeClassName}>Vigilar: {webVitalsHealth.warning}</Badge>
                  <Badge variant="outline" className={getHealthMeta('ok').badgeClassName}>OK: {webVitalsHealth.ok}</Badge>
                </div>
                <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                  <p className="mb-2 font-medium text-foreground">Qué mide cada métrica</p>
                  <ul className="space-y-1">
                    {WEB_VITAL_LEGEND.map((item) => (
                      <li key={item.name}>
                        <strong className="text-foreground">{item.name}</strong>: {item.description}
                      </li>
                    ))}
                  </ul>
                </div>
                <WebVitalsTable rows={webVitalRows} />
                {Boolean(webVitalsQuery.data?.topPoorPaths?.length) && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Rutas con más eventos "poor"</h3>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {webVitalsQuery.data?.topPoorPaths.slice(0, 5).map((entry) => (
                        <li key={entry.path} className="flex items-center justify-between gap-4 rounded border px-3 py-2">
                          <span className="font-mono text-xs sm:text-sm">{entry.path}</span>
                          <Badge variant="outline">{entry.poorCount}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-w-0 max-h-[calc(100vh-10rem)] flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              API (Top endpoints)
              <CardInfoTooltip label="Qué muestra esta card de API">
                Resume salud operativa de endpoints por subdominio: latencia media, p95, porcentaje de error y
                volumen de uso. El estado destaca primero lo que necesita atención.
              </CardInfoTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4 overflow-y-auto overflow-x-hidden">
            {apiQuery.error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  No se pudo cargar métricas de API
                </div>
                <p className="mt-1">{getErrorMessage(apiQuery.error)}</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>Eventos: <strong className="text-foreground">{apiQuery.data?.totalEvents ?? 0}</strong></span>
                  <span>Ventana: <strong className="text-foreground">{apiQuery.data?.windowMinutes ?? windowMinutes} min</strong></span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className={getHealthMeta('critical').badgeClassName}>Crítico: {apiHealth.critical}</Badge>
                  <Badge variant="outline" className={getHealthMeta('warning').badgeClassName}>Vigilar: {apiHealth.warning}</Badge>
                  <Badge variant="outline" className={getHealthMeta('ok').badgeClassName}>OK: {apiHealth.ok}</Badge>
                </div>
                <ApiTable rows={apiRows} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="flex min-w-0 flex-col">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                I18N Operativa (cross-tenant)
                <CardInfoTooltip label="Qué muestra esta card i18n">
                  Estado de traducciones por tenant para actuar rápido: cola pendiente, salud de fallos, consumo mensual y
                  control inmediato de pausa/reanudación.
                </CardInfoTooltip>
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Resumen platform-level para tomar decisiones de operación en segundos.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2">
              <span className="text-xs text-muted-foreground">Solo alertas</span>
              <CardInfoTooltip label="Info solo alertas">
                Activo: muestra únicamente tenants con estado Vigilar, Crítico o Pausado. Desactivo: muestra todos.
              </CardInfoTooltip>
              <Switch checked={showIssuesOnly} onCheckedChange={setShowIssuesOnly} />
            </div>
          </div>
          {i18nSummary && (
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg border border-border/60 px-3 py-2">
                <MetricLabelWithTooltip
                  label="Tenants"
                  tooltip="Cantidad total de tenants incluidos en este resumen."
                />
                <p className="text-lg font-semibold">{formatInteger(i18nSummary.totalTenants)}</p>
              </div>
              <div className="rounded-lg border border-border/60 px-3 py-2">
                <MetricLabelWithTooltip
                  label="Crítico"
                  tooltip="Tenants con incidencia grave: fallos altos o límites mensuales superados."
                />
                <p className="text-lg font-semibold text-destructive">{formatInteger(i18nSummary.statuses.critical)}</p>
              </div>
              <div className="rounded-lg border border-border/60 px-3 py-2">
                <MetricLabelWithTooltip
                  label="Pausados"
                  tooltip="Tenants con la auto-traducción detenida manualmente o por pausa activa."
                />
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-300">{formatInteger(i18nSummary.pausedTenants)}</p>
              </div>
              <div className="rounded-lg border border-border/60 px-3 py-2">
                <MetricLabelWithTooltip
                  label="Cerca del límite"
                  tooltip={`Tenants por encima del ${Math.round((i18nQuery.data?.nearLimitThreshold || 0.8) * 100)}% de su límite mensual.`}
                />
                <p className="text-lg font-semibold text-amber-600 dark:text-amber-300">{formatInteger(i18nSummary.nearLimitTenants)}</p>
              </div>
              <div className="rounded-lg border border-border/60 px-3 py-2">
                <MetricLabelWithTooltip
                  label="Fallo alto"
                  tooltip="Tenants cuyo ratio de error en la ventana supera el umbral operativo configurado."
                />
                <p className="text-lg font-semibold text-destructive">{formatInteger(i18nSummary.highFailureTenants)}</p>
              </div>
              <div className="rounded-lg border border-border/60 px-3 py-2">
                <MetricLabelWithTooltip
                  label="Cola total"
                  tooltip="Total de traducciones pendientes sumando todos los tenants."
                />
                <p className="text-lg font-semibold">{formatInteger(i18nSummary.pendingQueueTotal)}</p>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4 overflow-x-auto">
          {i18nActionMutation.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {getErrorMessage(i18nActionMutation.error)}
            </div>
          )}
          {i18nQuery.error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                No se pudo cargar observabilidad i18n
              </div>
              <p className="mt-1">{getErrorMessage(i18nQuery.error)}</p>
            </div>
          ) : i18nQuery.data ? (
            <I18nTenantsTable
              data={i18nQuery.data}
              showIssuesOnly={showIssuesOnly}
              actionBrandId={
                i18nActionMutation.isPending ? i18nActionMutation.variables?.brandId || null : null
              }
              onTogglePaused={(brandId, currentlyPaused) =>
                i18nActionMutation.mutate({ brandId, currentlyPaused })
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">Cargando estado i18n...</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
};

export default PlatformObservability;
