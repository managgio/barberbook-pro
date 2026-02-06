import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getPlatformApiMetricsSummary,
  getPlatformWebVitalsSummary,
} from '@/data/api/observability';
import {
  PlatformObservabilityApiRouteSummary,
  PlatformObservabilityApiSummary,
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

const WebVitalsTable: React.FC<{ rows: PlatformObservabilityWebVitalMetricSummary[] }> = ({ rows }) => {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay muestras de Web Vitals para esta ventana.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Métrica</TableHead>
          <TableHead>Promedio</TableHead>
          <TableHead>P95</TableHead>
          <TableHead>Muestras</TableHead>
          <TableHead>Poor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.name}>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="font-medium">{row.name}</span>
                {CRITICAL_WEB_VITALS.has(row.name) && <Badge variant="secondary">Crítica</Badge>}
              </div>
            </TableCell>
            <TableCell>{row.name === 'CLS' ? row.avg.toFixed(3) : formatMs(row.avg)}</TableCell>
            <TableCell>{row.name === 'CLS' ? row.p95.toFixed(3) : formatMs(row.p95)}</TableCell>
            <TableCell>{row.count}</TableCell>
            <TableCell>{row.ratings.poor}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const ApiTable: React.FC<{ rows: PlatformObservabilityApiRouteSummary[] }> = ({ rows }) => {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay tráfico de API registrado para esta ventana.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ruta</TableHead>
          <TableHead>Latencia media</TableHead>
          <TableHead>P95</TableHead>
          <TableHead>Error ratio</TableHead>
          <TableHead>Hits</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.method}-${row.route}`}>
            <TableCell className="font-mono text-xs sm:text-sm">{row.method} {row.route}</TableCell>
            <TableCell>{formatMs(row.avgDurationMs)}</TableCell>
            <TableCell>{formatMs(row.p95DurationMs)}</TableCell>
            <TableCell>{formatPct(row.errorRate)}</TableCell>
            <TableCell>{row.count}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const PlatformObservability: React.FC = () => {
  const [windowMinutes, setWindowMinutes] = useState<number>(60);

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

  const isRefreshing = webVitalsQuery.isFetching || apiQuery.isFetching;

  const webVitalRows = useMemo(
    () => (webVitalsQuery.data?.byMetric || []).slice().sort((a, b) => b.count - a.count),
    [webVitalsQuery.data?.byMetric],
  );
  const apiRows = useMemo(
    () => (apiQuery.data?.topRoutes || []).slice(0, 20),
    [apiQuery.data?.topRoutes],
  );

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Observabilidad</h1>
          <p className="text-sm text-muted-foreground">
            Vista rápida de experiencia de usuario y salud de API para plataforma.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
              void Promise.all([webVitalsQuery.refetch(), apiQuery.refetch()]);
            }}
            disabled={isRefreshing}
          >
            <RefreshCcw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex max-h-[calc(100vh-10rem)] flex-col">
          <CardHeader>
            <CardTitle>Experiencia (Web Vitals)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 overflow-y-auto">
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

        <Card className="flex max-h-[calc(100vh-10rem)] flex-col">
          <CardHeader>
            <CardTitle>API (Top endpoints)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 overflow-y-auto">
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
                <ApiTable rows={apiRows} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default PlatformObservability;
