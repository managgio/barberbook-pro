import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, Building2, ChevronLeft, ChevronRight, Image as ImageIcon, MapPin, PhoneCall, RefreshCcw, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getPlatformBrands, getPlatformMetrics, refreshPlatformMetrics } from '@/data/api';
import { PlatformUsageMetrics, PlatformUsageSeriesPoint } from '@/data/types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Area,
  AreaChart,
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

const formatUsd = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);

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


const PlatformDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [brands, setBrands] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usageRange, setUsageRange] = useState(7);
  const [usageMetrics, setUsageMetrics] = useState<PlatformUsageMetrics | null>(null);
  const [isUsageLoading, setIsUsageLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await getPlatformBrands(user.id);
        setBrands(data);
      } catch (error) {
        toast({ title: 'Error', description: 'No se pudo cargar el resumen de plataforma.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user?.id, toast]);

  const loadUsage = useCallback(
    async (forceRefresh = false) => {
      if (!user?.id) return;
      setIsUsageLoading(true);
      try {
        const data = forceRefresh
          ? await refreshPlatformMetrics(user.id, usageRange)
          : await getPlatformMetrics(user.id, usageRange);
        setUsageMetrics(data);
      } catch (error) {
        toast({ title: 'Error', description: 'No se pudieron cargar las métricas de consumo.', variant: 'destructive' });
      } finally {
        setIsUsageLoading(false);
      }
    },
    [user?.id, usageRange, toast],
  );

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

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

  const openaiSeries = usageMetrics?.openai.series ?? [];
  const twilioSeries = usageMetrics?.twilio.series ?? [];
  const imagekitSeries = usageMetrics?.imagekit.series ?? [];
  const thresholds = usageMetrics?.thresholds;

  const openaiSummary = useMemo(
    () => summarizeSeries(openaiSeries, 'costUsd', thresholds?.openaiDailyCostUsd),
    [openaiSeries, thresholds?.openaiDailyCostUsd],
  );
  const twilioSummary = useMemo(
    () => summarizeSeries(twilioSeries, 'costUsd', thresholds?.twilioDailyCostUsd),
    [twilioSeries, thresholds?.twilioDailyCostUsd],
  );
  const openaiTokensTotal = useMemo(
    () => openaiSeries.reduce((acc, entry) => acc + (entry.tokensTotal || 0), 0),
    [openaiSeries],
  );
  const twilioMessagesTotal = useMemo(
    () => twilioSeries.reduce((acc, entry) => acc + (entry.messagesCount || 0), 0),
    [twilioSeries],
  );
  const openaiCostPer1k = openaiTokensTotal > 0 ? openaiSummary.total / (openaiTokensTotal / 1000) : 0;
  const twilioCostPerMessage = twilioMessagesTotal > 0 ? twilioSummary.total / twilioMessagesTotal : 0;

  const imagekitLatest = imagekitSeries[imagekitSeries.length - 1] || {
    storageUsedBytes: 0,
    storageLimitBytes: 0,
  };
  const imagekitUsagePct =
    imagekitLatest.storageLimitBytes > 0
      ? (imagekitLatest.storageUsedBytes / imagekitLatest.storageLimitBytes) * 100
      : 0;

  const openaiChartData = useMemo(
    () =>
      openaiSeries.map((entry) => ({
        dateKey: entry.dateKey,
        label: formatDateLabel(entry.dateKey),
        costUsd: entry.costUsd,
        tokensTotal: entry.tokensTotal,
      })),
    [openaiSeries],
  );

  const twilioChartData = useMemo(
    () =>
      twilioSeries.map((entry) => ({
        dateKey: entry.dateKey,
        label: formatDateLabel(entry.dateKey),
        costUsd: entry.costUsd,
        messagesCount: entry.messagesCount,
      })),
    [twilioSeries],
  );

  const imagekitChartData = useMemo(
    () =>
      imagekitSeries.map((entry) => ({
        dateKey: entry.dateKey,
        label: formatDateLabel(entry.dateKey),
        storageUsedBytes: entry.storageUsedBytes,
        storageLimitBytes: entry.storageLimitBytes,
      })),
    [imagekitSeries],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Panel principal
        </div>
        <h1 className="text-3xl font-semibold text-foreground">Plataforma Managgio</h1>
        <p className="text-muted-foreground max-w-2xl">
          Controla marcas, locales y configuraciones desde un único espacio. Aquí tienes el estado global de la plataforma.
        </p>
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
              onClick={() => loadUsage(true)}
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
                {thresholds?.twilioDailyCostUsd ? (
                  <Badge variant={twilioSummary.peakValue >= thresholds.twilioDailyCostUsd ? 'destructive' : 'secondary'}>
                    Límite diario {formatUsd(thresholds.twilioDailyCostUsd)}
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">Gasto y volumen de mensajes enviados.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Gasto total</p>
                  <p className="text-lg font-semibold">{isUsageLoading ? '—' : formatUsd(twilioSummary.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Mensajes</p>
                  <p className="text-lg font-semibold">{isUsageLoading ? '—' : formatNumber(twilioMessagesTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Coste/mensaje</p>
                  <p className="text-lg font-semibold">
                    {isUsageLoading || twilioMessagesTotal === 0 ? '—' : formatUsd(twilioCostPerMessage)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pico diario</p>
                  <p className="text-sm font-semibold text-foreground">
                    {isUsageLoading || !twilioSummary.peakDate
                      ? '—'
                      : `${formatUsd(twilioSummary.peakValue)} · ${formatDateLabel(twilioSummary.peakDate)}`}
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
                          if (name === 'costUsd') return [formatUsd(Number(value)), 'Coste'];
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
                      {thresholds?.twilioDailyCostUsd ? (
                        <ReferenceLine
                          yAxisId="cost"
                          y={thresholds.twilioDailyCostUsd}
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
                {thresholds?.openaiDailyCostUsd ? (
                  <Badge variant={openaiSummary.peakValue >= thresholds.openaiDailyCostUsd ? 'destructive' : 'secondary'}>
                    Límite diario {formatUsd(thresholds.openaiDailyCostUsd)}
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">Coste y tokens consumidos por el asistente.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Gasto total</p>
                  <p className="text-lg font-semibold">{isUsageLoading ? '—' : formatUsd(openaiSummary.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tokens</p>
                  <p className="text-lg font-semibold">{isUsageLoading ? '—' : formatCompact(openaiTokensTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Coste / 1k tokens</p>
                  <p className="text-lg font-semibold">
                    {isUsageLoading || openaiTokensTotal === 0 ? '—' : formatUsd(openaiCostPer1k)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pico diario</p>
                  <p className="text-sm font-semibold text-foreground">
                    {isUsageLoading || !openaiSummary.peakDate
                      ? '—'
                      : `${formatUsd(openaiSummary.peakValue)} · ${formatDateLabel(openaiSummary.peakDate)}`}
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
                      <YAxis
                        yAxisId="tokens"
                        orientation="right"
                        tickFormatter={(value) => formatCompact(Number(value))}
                      />
                      <RechartsTooltip
                        formatter={(value, name) => {
                          if (name === 'costUsd') return [formatUsd(Number(value)), 'Coste'];
                          if (name === 'tokensTotal') return [formatNumber(Number(value)), 'Tokens'];
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
                      <Line
                        yAxisId="tokens"
                        type="monotone"
                        dataKey="tokensTotal"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={false}
                      />
                      {thresholds?.openaiDailyCostUsd ? (
                        <ReferenceLine
                          yAxisId="cost"
                          y={thresholds.openaiDailyCostUsd}
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
                  {isUsageLoading ? 'Capacidad —' : `${imagekitUsagePct.toFixed(0)}% usado`}
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
                      : formatBytes(imagekitLatest.storageLimitBytes || thresholds?.imagekitStorageBytes || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Disponible</p>
                  <p className="text-lg font-semibold">
                    {isUsageLoading
                      ? '—'
                      : formatBytes(
                          Math.max(
                            (imagekitLatest.storageLimitBytes || thresholds?.imagekitStorageBytes || 0)
                              - imagekitLatest.storageUsedBytes,
                            0,
                          ),
                        )}
                  </p>
                </div>
              </div>
              <div className="h-72">
                {isUsageLoading ? (
                  <div className="text-sm text-muted-foreground">Cargando métricas...</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={imagekitChartData} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis tickFormatter={(value) => formatBytes(Number(value))} />
                      <RechartsTooltip
                        formatter={(value, name) => {
                          if (name === 'storageUsedBytes') return [formatBytes(Number(value)), 'Usado'];
                          if (name === 'storageLimitBytes') return [formatBytes(Number(value)), 'Límite'];
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
                      <Area
                        type="monotone"
                        dataKey="storageUsedBytes"
                        stroke="#14b8a6"
                        fill="rgba(20, 184, 166, 0.2)"
                        strokeWidth={2}
                      />
                      <Line type="monotone" dataKey="storageLimitBytes" stroke="#f97316" strokeWidth={2} dot={false} />
                      {thresholds?.imagekitStorageBytes ? (
                        <ReferenceLine
                          y={thresholds.imagekitStorageBytes}
                          stroke="#ef4444"
                          strokeDasharray="4 4"
                        />
                      ) : null}
                    </AreaChart>
                  </ResponsiveContainer>
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
