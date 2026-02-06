import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useBusinessCopy } from '@/lib/businessCopy';
import { useTenant } from '@/context/TenantContext';
import {
  getReviewConfig,
  updateReviewConfig,
  getReviewMetrics,
  getReviewFeedback,
  resolveReviewFeedback,
} from '@/data/api';
import { ReviewProgramConfig, ReviewMetrics, ReviewFeedbackItem } from '@/data/types';
import { Info } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);
const FEEDBACK_PAGE = 1;
const FEEDBACK_PAGE_SIZE = 20;
const EMPTY_FEEDBACK: { total: number; items: ReviewFeedbackItem[] } = { total: 0, items: [] };

const AdminReviews: React.FC = () => {
  const { toast } = useToast();
  const { currentLocationId } = useTenant();
  const queryClient = useQueryClient();
  const copy = useBusinessCopy();
  const [config, setConfig] = useState<ReviewProgramConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatDateInput(d);
  });
  const [to, setTo] = useState(() => formatDateInput(new Date()));
  const [feedbackStatus, setFeedbackStatus] = useState<'OPEN' | 'RESOLVED' | 'ALL'>('OPEN');
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoKey, setInfoKey] = useState<
    'googleUrl' | 'cooldown' | 'minVisits' | 'delay' | 'maxSnoozes' | 'snoozeHours' | 'metrics' | null
  >(null);

  const infoContent = {
    googleUrl: {
      title: 'URL de reseña en Google',
      body: `Enlace directo para escribir una reseña ${copy.location.fromWithDefinite} en Google. Se abre en nueva pestaña cuando el cliente acepta.`,
    },
    cooldown: {
      title: 'Cooldown',
      body: `Tiempo mínimo entre solicitudes de reseña para el mismo cliente en ${copy.location.definiteSingular}.`,
    },
    minVisits: {
      title: 'Mínimo de visitas',
      body: 'Número de citas COMPLETED necesarias antes de pedir una reseña.',
    },
    delay: {
      title: 'Retraso tras completar',
      body: 'Minutos de espera después de completar la cita antes de poder mostrar el modal.',
    },
    maxSnoozes: {
      title: 'Máximo de recordatorios',
      body: 'Cuántas veces puede pulsar “Ahora no” antes de dejar de mostrar el modal.',
    },
    snoozeHours: {
      title: 'Horas para reintentar',
      body: 'Horas que se espera tras un “Ahora no” antes de volver a mostrar el modal.',
    },
    metrics: {
      title: 'Cómo se calculan las métricas',
      body:
        'Solicitudes: veces que se creó la petición de reseña en esas fechas.\n' +
        'Mostradas: veces que el aviso apareció en pantalla.\n' +
        'Valoradas: clientes que dejaron estrellas.\n' +
        'Clicks Google: clientes que hicieron clic para ir a Google (no significa que hayan escrito la reseña).\n' +
        'Feedback privado: clientes que pusieron 1–3 estrellas y dejaron un comentario.\n' +
        'Conversión: porcentaje de clics a Google sobre las mostradas.',
    },
  } as const;

  const openInfo = (key: typeof infoKey) => {
    setInfoKey(key);
    setInfoOpen(true);
  };

  const configQuery = useQuery({
    queryKey: queryKeys.adminReviewConfig(currentLocationId),
    queryFn: getReviewConfig,
  });
  const metricsQuery = useQuery<ReviewMetrics>({
    queryKey: queryKeys.adminReviewMetrics(currentLocationId, from, to),
    queryFn: () => getReviewMetrics({ from, to }),
  });
  const feedbackQueryKey = queryKeys.adminReviewFeedback(
    currentLocationId,
    feedbackStatus,
    FEEDBACK_PAGE,
    FEEDBACK_PAGE_SIZE,
  );
  const feedbackQuery = useQuery<{ total: number; items: ReviewFeedbackItem[] }>({
    queryKey: feedbackQueryKey,
    queryFn: () =>
      getReviewFeedback({
        status: feedbackStatus === 'ALL' ? undefined : feedbackStatus,
        page: FEEDBACK_PAGE,
        pageSize: FEEDBACK_PAGE_SIZE,
      }),
  });

  useEffect(() => {
    if (!configQuery.data) return;
    setConfig(configQuery.data);
  }, [configQuery.data]);

  useEffect(() => {
    if (!configQuery.error && !metricsQuery.error) return;
    toast({
      title: 'No se pudo cargar reseñas',
      description: 'Inténtalo de nuevo.',
      variant: 'destructive',
    });
  }, [configQuery.error, metricsQuery.error, toast]);

  useEffect(() => {
    if (!feedbackQuery.error) return;
    toast({
      title: 'No se pudo cargar feedback',
      description: 'Inténtalo de nuevo.',
      variant: 'destructive',
    });
  }, [feedbackQuery.error, toast]);

  const metrics = metricsQuery.data ?? null;
  const feedback = feedbackQuery.data ?? EMPTY_FEEDBACK;
  const isLoading = configQuery.isLoading || metricsQuery.isLoading || !config;

  const updateConfigField = <K extends keyof ReviewProgramConfig>(key: K, value: ReviewProgramConfig[K]) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  };

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      const updated = await updateReviewConfig(config);
      setConfig(updated);
      queryClient.setQueryData(queryKeys.adminReviewConfig(currentLocationId), updated);
      toast({
        title: 'Configuración guardada',
        description: 'Reseñas inteligentes actualizadas.',
      });
    } catch (error) {
      toast({
        title: 'No se pudo guardar',
        description: error instanceof Error ? error.message : 'Revisa los datos.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await resolveReviewFeedback(id);
      queryClient.setQueryData<{ total: number; items: ReviewFeedbackItem[] }>(feedbackQueryKey, (previous) => ({
        total: previous?.total ?? 0,
        items: (previous?.items ?? EMPTY_FEEDBACK.items).map((item) =>
          item.id === id ? { ...item, feedbackStatus: 'RESOLVED' } : item,
        ),
      }));
      toast({
        title: 'Feedback resuelto',
        description: 'Se marcó como resuelto.',
      });
    } catch (error) {
      toast({
        title: 'No se pudo resolver',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  };

  const metricsCards = useMemo(() => {
    if (!metrics) return [];
    return [
      { label: 'Solicitudes', value: metrics.createdCount },
      { label: 'Mostradas', value: metrics.shownCount },
      { label: 'Valoradas', value: metrics.ratedCount },
      { label: 'Clicks Google', value: metrics.googleClicksCount },
      { label: 'Feedback privado', value: metrics.feedbackCount },
      { label: 'Conversión', value: `${(metrics.conversionRate * 100).toFixed(1)}%` },
    ];
  }, [metrics]);

  if (isLoading || !config) {
    return <div className="text-muted-foreground">Cargando reseñas...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="pl-12 md:pl-0">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground">Reseñas inteligentes</h1>
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Cómo se calculan las métricas"
              onClick={() => openInfo('metrics')}
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
          <p className="text-muted-foreground">
            Pide reseñas en el momento perfecto, sin molestar.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Desde</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Hasta</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metricsCards.map((card) => (
          <Card key={card.label} variant="elevated">
            <CardHeader className="pb-2">
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className="text-2xl">{card.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">Configuración</TabsTrigger>
          <TabsTrigger value="feedback">Feedback privado</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>Programa de reseñas</CardTitle>
              <CardDescription>
                Configura cuándo y cómo pedir reseñas in-app.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Activar reseñas inteligentes</p>
                  <p className="text-xs text-muted-foreground">Solo se mostrarán tras citas completadas.</p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) => updateConfigField('enabled', checked)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>URL de reseña en Google</Label>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Más información sobre URL de reseña"
                      onClick={() => openInfo('googleUrl')}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Input
                    value={config.googleReviewUrl ?? ''}
                    onChange={(e) => updateConfigField('googleReviewUrl', e.target.value)}
                    placeholder="https://g.page/..."
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Cooldown (días)</Label>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Más información sobre cooldown"
                      onClick={() => openInfo('cooldown')}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    value={config.cooldownDays}
                    onChange={(e) => updateConfigField('cooldownDays', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Mínimo de visitas</Label>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Más información sobre mínimo de visitas"
                      onClick={() => openInfo('minVisits')}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    value={config.minVisitsToAsk}
                    onChange={(e) => updateConfigField('minVisitsToAsk', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Retraso tras completar (min)</Label>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Más información sobre retraso"
                      onClick={() => openInfo('delay')}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={config.showDelayMinutes}
                    onChange={(e) => updateConfigField('showDelayMinutes', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Máx. recordatorios</Label>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Más información sobre recordatorios"
                      onClick={() => openInfo('maxSnoozes')}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={config.maxSnoozes}
                    onChange={(e) => updateConfigField('maxSnoozes', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Horas para reintentar</Label>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Más información sobre reintento"
                      onClick={() => openInfo('snoozeHours')}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    value={config.snoozeHours}
                    onChange={(e) => updateConfigField('snoozeHours', Number(e.target.value))}
                  />
                </div>
              </div>

              <Separator />
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Textos del modal</p>
                  <p className="text-xs text-muted-foreground">Personaliza el copy visible al cliente.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Título</Label>
                    <Input
                      value={config.copyJson.title}
                      onChange={(e) =>
                        updateConfigField('copyJson', { ...config.copyJson, title: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Subtítulo</Label>
                    <Textarea
                      value={config.copyJson.subtitle}
                      onChange={(e) =>
                        updateConfigField('copyJson', { ...config.copyJson, subtitle: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Texto positivo</Label>
                    <Textarea
                      value={config.copyJson.positiveText}
                      onChange={(e) =>
                        updateConfigField('copyJson', { ...config.copyJson, positiveText: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Texto negativo</Label>
                    <Textarea
                      value={config.copyJson.negativeText}
                      onChange={(e) =>
                        updateConfigField('copyJson', { ...config.copyJson, negativeText: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4">
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>Feedback privado</CardTitle>
              <CardDescription>
                Comentarios de clientes con valoraciones de 1 a 3 estrellas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(['OPEN', 'RESOLVED', 'ALL'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={feedbackStatus === status ? 'default' : 'outline'}
                    onClick={() => setFeedbackStatus(status)}
                  >
                    {status === 'OPEN' ? 'Abierto' : status === 'RESOLVED' ? 'Resuelto' : 'Todos'}
                  </Button>
                ))}
              </div>

              {feedback.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay feedback pendiente.</p>
              ) : (
                <div className="space-y-3">
                  {feedback.items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">
                            {item.clientName || item.guestContact || 'Invitado'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.serviceName || 'Servicio'} · {item.barberName || copy.staff.singular}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.appointmentDate ? new Date(item.appointmentDate).toLocaleString() : ''}
                          </p>
                        </div>
                        <Badge variant={item.feedbackStatus === 'OPEN' ? 'destructive' : 'secondary'}>
                          {item.feedbackStatus === 'OPEN' ? 'Abierto' : 'Resuelto'}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm text-foreground/90">{item.privateFeedback}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Rating: {item.rating ?? '-'}</span>
                        {item.feedbackStatus === 'OPEN' && (
                          <Button size="sm" onClick={() => handleResolve(item.id)}>
                            Marcar resuelto
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{infoKey ? infoContent[infoKey].title : 'Información'}</DialogTitle>
            <DialogDescription className="whitespace-pre-line">
              {infoKey ? infoContent[infoKey].body : ''}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReviews;
