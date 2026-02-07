import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, Building2, ChevronLeft, ChevronRight, ExternalLink, Image as ImageIcon, MapPin, PhoneCall, RefreshCcw, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getPlatformBrands, getPlatformMetrics, refreshPlatformMetrics } from '@/data/api/platform';
import { PlatformUsageMetrics, PlatformUsageSeriesPoint } from '@/data/types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

const usageRanges = [
  { label: '7 días', value: 7 },
  { label: '14 días', value: 14 },
  { label: '30 días', value: 30 },
];

const USD_EUR_RATE = (() => {
  const raw = Number(import.meta.env.VITE_USD_EUR_RATE);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
})();

const toDisplayCurrency = (value: number) => (USD_EUR_RATE ? value * USD_EUR_RATE : value);
const displayCurrencyCode = USD_EUR_RATE ? 'EUR' : 'USD';

const formatMoney = (value: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: displayCurrencyCode,
    maximumFractionDigits,
  }).format(value);

const formatNumber = (value: number) => new Intl.NumberFormat('es-ES').format(value);

const formatCompact = (value: number) =>
  new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const formatDateLabel = (dateKey: string) => {
  try {
    return format(parseISO(dateKey), 'dd MMM', { locale: es });
  } catch {
    return dateKey;
  }
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatUsagePercentage = (value: number) => `${Math.min(Math.max(value, 0), 100).toFixed(1)}%`;
const isProductionManaggioHost = () => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === 'managgio.com' || hostname.endsWith('.managgio.com');
};

const summarizeSeries = (
  series: PlatformUsageSeriesPoint[],
  key: keyof PlatformUsageSeriesPoint,
  threshold?: number | null,
) => {
  if (!series.length) {
    return { total: 0, avg: 0, peakValue: 0, peakDate: null as string | null, anomalies: 0 };
  }
  const total = series.reduce((acc, entry) => acc + (Number(entry[key]) || 0), 0);
  const avg = total / series.length;
  let peakValue = 0;
  let peakDate: string | null = null;
  series.forEach((entry) => {
    const value = Number(entry[key]) || 0;
    if (value > peakValue) {
      peakValue = value;
      peakDate = entry.dateKey;
    }
  });
  const anomalyThreshold = avg * 1.8;
  const anomalies = series.filter((entry) => {
    const value = Number(entry[key]) || 0;
    if (threshold && value >= threshold) return true;
    return value >= anomalyThreshold && value > 0;
  }).length;
  return { total, avg, peakValue, peakDate, anomalies };
};

type PlatformBrandSummary = {
  id: string;
  isActive?: boolean;
  createdAt?: string;
  locations?: Array<{ id: string }>;
};
const EMPTY_BRANDS: PlatformBrandSummary[] = [];
const EMPTY_USAGE_SERIES: PlatformUsageSeriesPoint[] = [];

const PlatformDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [usageRange, setUsageRange] = useState(7);
  const [isRefreshingUsage, setIsRefreshingUsage] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const queryClient = useQueryClient();
  const showCrmShortcut = import.meta.env.PROD && isProductionManaggioHost();

  const brandsQuery = useQuery<PlatformBrandSummary[]>({
    queryKey: queryKeys.platformBrands(),
    queryFn: getPlatformBrands,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
  const usageMetricsQuery = useQuery<PlatformUsageMetrics>({
    queryKey: queryKeys.platformMetrics(usageRange),
    queryFn: () => getPlatformMetrics(usageRange),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!brandsQuery.isError) return;
    toast({ title: 'Error', description: 'No se pudo cargar el resumen de plataforma.', variant: 'destructive' });
  }, [brandsQuery.isError, brandsQuery.errorUpdatedAt, toast]);

  useEffect(() => {
    if (!usageMetricsQuery.isError) return;
    toast({ title: 'Error', description: 'No se pudieron cargar las métricas de consumo.', variant: 'destructive' });
  }, [usageMetricsQuery.isError, usageMetricsQuery.errorUpdatedAt, toast]);

  const brands = useMemo(
    () => brandsQuery.data ?? EMPTY_BRANDS,
    [brandsQuery.data],
  );
  const usageMetrics = usageMetricsQuery.data ?? null;
  const isLoading = brandsQuery.isLoading;
  const isUsageLoading = usageMetricsQuery.isLoading || usageMetricsQuery.isFetching || isRefreshingUsage;

  const handleUsageRefresh = async () => {
    if (!user?.id) return;
    setIsRefreshingUsage(true);
    try {
      const data = await refreshPlatformMetrics(usageRange);
      queryClient.setQueryData(queryKeys.platformMetrics(usageRange), data);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar las métricas de consumo.', variant: 'destructive' });
    } finally {
      setIsRefreshingUsage(false);
    }
  };

  const stats = useMemo(() => {
    const totalBrands = brands.length;
    const activeBrands = brands.filter((brand) => brand.isActive).length;
    const totalLocations = brands.reduce((acc, brand) => acc + (brand.locations?.length || 0), 0);
    return { totalBrands, activeBrands, totalLocations };
  }, [brands]);

  const brandYears = useMemo(() => {
    const yearSet = new Set<number>();
    brands.forEach((brand) => {
      if (!brand?.createdAt) return;
      const date = new Date(brand.createdAt);
      if (!Number.isFinite(date.getTime())) return;
      yearSet.add(date.getFullYear());
    });
    if (yearSet.size === 0) {
      yearSet.add(new Date().getFullYear());
    }
    const sorted = Array.from(yearSet).sort((a, b) => a - b);
    const minYear = sorted[0];
    const maxYear = sorted[sorted.length - 1];
    const currentYear = new Date().getFullYear();
    if (currentYear < minYear) sorted.unshift(currentYear);
    if (currentYear > maxYear) sorted.push(currentYear);
    return sorted;
  }, [brands]);

  const minYear = brandYears[0] ?? new Date().getFullYear();
  const maxYear = brandYears[brandYears.length - 1] ?? new Date().getFullYear();

  useEffect(() => {
    if (selectedYear < minYear) {
      setSelectedYear(minYear);
      return;
    }
    if (selectedYear > maxYear) {
      setSelectedYear(maxYear);
    }
  }, [selectedYear, minYear, maxYear]);

  const monthlyBrandData = useMemo(() => {
    const months = Array.from({ length: 12 }).map((_, index) => {
      const rawLabel = format(new Date(selectedYear, index, 1), 'MMM', { locale: es });
      const monthLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
      return {
        monthIndex: index,
        monthLabel,
        count: 0,
      };
    });
    brands.forEach((brand) => {
      if (!brand?.createdAt) return;
      const date = new Date(brand.createdAt);
      if (!Number.isFinite(date.getTime())) return;
      if (date.getFullYear() !== selectedYear) return;
      months[date.getMonth()].count += 1;
    });
    return months;
  }, [brands, selectedYear]);

  const monthlyBrandSummary = useMemo(() => {
    const total = monthlyBrandData.reduce((acc, entry) => acc + entry.count, 0);
    const avg = total / 12;
    let peak = { count: 0, monthLabel: '' };
    monthlyBrandData.forEach((entry) => {
      if (entry.count > peak.count) {
        peak = { count: entry.count, monthLabel: entry.monthLabel };
      }
    });
    return { total, avg, peak };
  }, [monthlyBrandData]);

  const openaiSeries = useMemo(
    () => usageMetrics?.openai.series ?? EMPTY_USAGE_SERIES,
    [usageMetrics?.openai.series],
  );
  const twilioSeries = useMemo(
    () => usageMetrics?.twilio.series ?? EMPTY_USAGE_SERIES,
    [usageMetrics?.twilio.series],
  );
  const imagekitSeries = useMemo(
    () => usageMetrics?.imagekit.series ?? EMPTY_USAGE_SERIES,
    [usageMetrics?.imagekit.series],
  );
  const thresholds = usageMetrics?.thresholds;
  const openaiThreshold = thresholds?.openaiDailyCostUsd ? toDisplayCurrency(thresholds.openaiDailyCostUsd) : null;
  const twilioThreshold = thresholds?.twilioDailyCostUsd ? toDisplayCurrency(thresholds.twilioDailyCostUsd) : null;
  const openaiSeriesDisplay = useMemo(
    () => openaiSeries.map((entry) => ({ ...entry, costUsd: toDisplayCurrency(entry.costUsd) })),
    [openaiSeries],
  );
  const twilioSeriesDisplay = useMemo(
    () => twilioSeries.map((entry) => ({ ...entry, costUsd: toDisplayCurrency(entry.costUsd) })),
    [twilioSeries],
  );

  const openaiSummary = useMemo(
    () => summarizeSeries(openaiSeriesDisplay, 'costUsd', openaiThreshold),
    [openaiSeriesDisplay, openaiThreshold],
  );
  const twilioSummary = useMemo(
    () => summarizeSeries(twilioSeriesDisplay, 'costUsd', twilioThreshold),
    [twilioSeriesDisplay, twilioThreshold],
  );
  const twilioMessagesTotal = useMemo(
    () => twilioSeriesDisplay.reduce((acc, entry) => acc + (entry.messagesCount || 0), 0),
    [twilioSeriesDisplay],
  );
  const twilioCostPerMessage = twilioMessagesTotal > 0 ? twilioSummary.total / twilioMessagesTotal : 0;

  const imagekitLatest = imagekitSeries[imagekitSeries.length - 1] || {
    storageUsedBytes: 0,
    storageLimitBytes: 0,
  };
  const imagekitUsagePct =
    imagekitLatest.storageLimitBytes > 0
      ? (imagekitLatest.storageUsedBytes / imagekitLatest.storageLimitBytes) * 100
      : 0;
  const imagekitLimitBytes = imagekitLatest.storageLimitBytes || thresholds?.imagekitStorageBytes || 0;
  const imagekitAvailableBytes = Math.max(imagekitLimitBytes - imagekitLatest.storageUsedBytes, 0);
  const imagekitUsagePctClamped = Math.min(Math.max(imagekitUsagePct, 0), 100);

  const openaiChartData = useMemo(
    () =>
      openaiSeriesDisplay.map((entry) => ({
        dateKey: entry.dateKey,
        label: formatDateLabel(entry.dateKey),
        costUsd: entry.costUsd,
      })),
    [openaiSeriesDisplay],
  );

  const twilioChartData = useMemo(
    () =>
      twilioSeriesDisplay.map((entry) => ({
        dateKey: entry.dateKey,
        label: formatDateLabel(entry.dateKey),
        costUsd: entry.costUsd,
        messagesCount: entry.messagesCount,
      })),
    [twilioSeriesDisplay],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Panel principal
          </div>
          <h1 className="text-3xl font-semibold text-foreground">Plataforma Managgio</h1>
          <p className="text-muted-foreground max-w-2xl">
            Controla marcas, locales y configuraciones desde un único espacio. Aquí tienes el estado global de la plataforma.
          </p>
        </div>
        {showCrmShortcut && (
          <Button asChild size="sm" variant="outline" className="w-fit md:ml-4 md:mt-1 md:self-start">
            <a
              href="https://managgio.com/admin"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Abrir CRM de Managgio"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Actualizar CRM
            </a>
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border border-border/60 bg-card/70">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Marcas activas</CardTitle>
            <Building2 className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {isLoading ? '—' : stats.activeBrands}
            </div>
            <p className="text-xs text-muted-foreground mt-1">de {isLoading ? '—' : stats.totalBrands} marcas</p>
          </CardContent>
        </Card>
        <Card className="border border-border/60 bg-card/70">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Locales registrados</CardTitle>
            <MapPin className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {isLoading ? '—' : stats.totalLocations}
            </div>
            <p className="text-xs text-muted-foreground mt-1">sumando todas las marcas</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Analítica de plataforma</div>
            <h2 className="text-xl font-semibold text-foreground">Clientes y proveedores</h2>
            <p className="text-sm text-muted-foreground">
              Crecimiento de marcas y consumo diario para gasto, eficiencia, picos y capacidad disponible.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {usageRanges.map((range) => (
              <Button
                key={range.value}
                size="sm"
                variant={usageRange === range.value ? 'default' : 'outline'}
                onClick={() => setUsageRange(range.value)}
                disabled={isUsageLoading}
              >
                {range.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={handleUsageRefresh}
              disabled={isUsageLoading}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Recargar
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border border-border/60 bg-card/70">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base">Crecimiento de clientes (marcas)</CardTitle>
                  <p className="text-xs text-muted-foreground">Altas de marcas por mes.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setSelectedYear((prev) => Math.max(minYear, prev - 1))}
                    disabled={isLoading || selectedYear <= minYear}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-[5rem] text-center text-sm font-semibold text-foreground">{selectedYear}</div>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setSelectedYear((prev) => Math.min(maxYear, prev + 1))}
                    disabled={isLoading || selectedYear >= maxYear}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Total del año</p>
                  <p className="text-lg font-semibold">{isLoading ? '—' : formatNumber(monthlyBrandSummary.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Media mensual</p>
                  <p className="text-lg font-semibold">{isLoading ? '—' : monthlyBrandSummary.avg.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Mes pico</p>
                  <p className="text-lg font-semibold">
                    {isLoading || !monthlyBrandSummary.peak.monthLabel
                      ? '—'
                      : `${monthlyBrandSummary.peak.monthLabel} · ${monthlyBrandSummary.peak.count}`}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-72">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Cargando marcas...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyBrandData} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monthLabel" />
                    <YAxis allowDecimals={false} />
                <RechartsTooltip
                  formatter={(value) => [formatNumber(Number(value)), 'Marcas']}
                  labelFormatter={(label) => `Mes: ${label}`}
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    color: 'hsl(var(--card-foreground))',
                    borderRadius: '12px',
                    border: 'none',
                  }}
                  labelStyle={{ color: 'hsl(var(--card-foreground))' }}
                />
                    <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-card/70">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Twilio · SMS</CardTitle>
                </div>
                {twilioThreshold ? (
                  <Badge variant={twilioSummary.peakValue >= twilioThreshold ? 'destructive' : 'secondary'}>
                    Límite diario {formatMoney(twilioThreshold)}
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">Gasto y volumen de mensajes enviados.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Gasto total</p>
                  <p className="text-lg font-semibold">{isUsageLoading ? '—' : formatMoney(twilioSummary.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Mensajes</p>
                  <p className="text-lg font-semibold">{isUsageLoading ? '—' : formatNumber(twilioMessagesTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Coste/mensaje</p>
                  <p className="text-lg font-semibold">
                    {isUsageLoading || twilioMessagesTotal === 0 ? '—' : formatMoney(twilioCostPerMessage, 4)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pico diario</p>
                  <p className="text-sm font-semibold text-foreground">
                    {isUsageLoading || !twilioSummary.peakDate
                      ? '—'
                      : `${formatMoney(twilioSummary.peakValue)} · ${formatDateLabel(twilioSummary.peakDate)}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Anomalías</p>
                  <p className="text-lg font-semibold">{isUsageLoading ? '—' : twilioSummary.anomalies}</p>
                </div>
              </div>
              <div className="h-64">
                {isUsageLoading ? (
                  <div className="text-sm text-muted-foreground">Cargando métricas...</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={twilioChartData} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis yAxisId="cost" tickFormatter={(value) => formatCompact(Number(value))} />
                      <YAxis yAxisId="messages" orientation="right" tickFormatter={(value) => formatCompact(Number(value))} />
                      <RechartsTooltip
                        formatter={(value, name) => {
                          if (name === 'costUsd') return [formatMoney(Number(value)), 'Coste'];
                          if (name === 'messagesCount') return [formatNumber(Number(value)), 'Mensajes'];
                          return [value, name];
                        }}
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          color: 'hsl(var(--card-foreground))',
                          borderRadius: '12px',
                          border: 'none',
                        }}
                        labelStyle={{ color: 'hsl(var(--card-foreground))' }}
                      />
                      <Line yAxisId="cost" type="monotone" dataKey="costUsd" stroke="#f97316" strokeWidth={2} dot={false} />
                      <Line
                        yAxisId="messages"
                        type="monotone"
                        dataKey="messagesCount"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        dot={false}
                      />
                      {twilioThreshold ? (
                        <ReferenceLine
                          yAxisId="cost"
                          y={twilioThreshold}
                          stroke="#ef4444"
                          strokeDasharray="4 4"
                        />
                      ) : null}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-card/70">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">OpenAI · IA</CardTitle>
                </div>
                {openaiThreshold ? (
                  <Badge variant={openaiSummary.peakValue >= openaiThreshold ? 'destructive' : 'secondary'}>
                    Límite diario {formatMoney(openaiThreshold)}
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">Coste y tokens consumidos por el asistente.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Gasto total</p>
                  <p className="text-lg font-semibold">{isUsageLoading ? '—' : formatMoney(openaiSummary.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pico diario</p>
                  <p className="text-sm font-semibold text-foreground">
                    {isUsageLoading || !openaiSummary.peakDate
                      ? '—'
                      : `${formatMoney(openaiSummary.peakValue)} · ${formatDateLabel(openaiSummary.peakDate)}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Anomalías</p>
                  <p className="text-lg font-semibold">{isUsageLoading ? '—' : openaiSummary.anomalies}</p>
                </div>
              </div>
              <div className="h-64">
                {isUsageLoading ? (
                  <div className="text-sm text-muted-foreground">Cargando métricas...</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={openaiChartData} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis yAxisId="cost" tickFormatter={(value) => formatCompact(Number(value))} />
                      <RechartsTooltip
                        formatter={(value, name) => {
                          if (name === 'costUsd') return [formatMoney(Number(value)), 'Coste'];
                          return [value, name];
                        }}
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          color: 'hsl(var(--card-foreground))',
                          borderRadius: '12px',
                          border: 'none',
                        }}
                        labelStyle={{ color: 'hsl(var(--card-foreground))' }}
                      />
                      <Line yAxisId="cost" type="monotone" dataKey="costUsd" stroke="#22c55e" strokeWidth={2} dot={false} />
                      {openaiThreshold ? (
                        <ReferenceLine
                          yAxisId="cost"
                          y={openaiThreshold}
                          stroke="#ef4444"
                          strokeDasharray="4 4"
                        />
                      ) : null}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-card/70">
            <CardHeader className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">ImageKit · Almacenamiento</CardTitle>
                  </div>
                <Badge variant={imagekitUsagePct >= 85 ? 'destructive' : 'secondary'}>
                  {isUsageLoading ? 'Capacidad —' : `${formatUsagePercentage(imagekitUsagePct)} usado`}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Espacio ocupado y límite disponible.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Ocupado</p>
                  <p className="text-lg font-semibold">
                    {isUsageLoading ? '—' : formatBytes(imagekitLatest.storageUsedBytes)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Límite</p>
                  <p className="text-lg font-semibold">
                    {isUsageLoading
                      ? '—'
                      : formatBytes(imagekitLimitBytes)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Disponible</p>
                  <p className="text-lg font-semibold">
                    {isUsageLoading ? '—' : formatBytes(imagekitAvailableBytes)}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
                {isUsageLoading ? (
                  <div className="text-sm text-muted-foreground">Cargando métricas...</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Uso actual</span>
                      <span className="font-semibold text-foreground">{formatUsagePercentage(imagekitUsagePct)}</span>
                    </div>
                    <div className="h-4 w-full overflow-hidden rounded-full bg-secondary/70">
                      <div
                        className={cn(
                          'h-full rounded-full transition-[width] duration-500 ease-out',
                          imagekitUsagePct >= 85
                            ? 'bg-gradient-to-r from-amber-500 to-red-500'
                            : imagekitUsagePct >= 65
                              ? 'bg-gradient-to-r from-sky-500 to-amber-400'
                              : 'bg-gradient-to-r from-emerald-500 to-teal-400',
                        )}
                        style={{ width: `${imagekitUsagePctClamped}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>0%</span>
                      <span>Meta recomendada: &lt; 85%</span>
                      <span>100%</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PlatformDashboard;
