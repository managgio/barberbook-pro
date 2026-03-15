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
} from '@/data/api/reviews';
import { ReviewProgramConfig, ReviewMetrics, ReviewFeedbackItem } from '@/data/types';
import { Info } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useI18n } from '@/hooks/useI18n';
import InlineTranslationPopover from '@/components/admin/InlineTranslationPopover';

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);
const FEEDBACK_PAGE = 1;
const FEEDBACK_PAGE_SIZE = 20;
const EMPTY_FEEDBACK: { total: number; items: ReviewFeedbackItem[] } = { total: 0, items: [] };

const AdminReviews: React.FC = () => {
  const { toast } = useToast();
  const { t, language } = useI18n();
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

  const infoContent = useMemo(
    () =>
      ({
        googleUrl: {
          title: t('admin.reviews.info.googleUrl.title'),
          body: t('admin.reviews.info.googleUrl.body', {
            locationFromWithDefinite: copy.location.fromWithDefinite,
          }),
        },
        cooldown: {
          title: t('admin.reviews.info.cooldown.title'),
          body: t('admin.reviews.info.cooldown.body', {
            locationDefiniteSingular: copy.location.definiteSingular,
          }),
        },
        minVisits: {
          title: t('admin.reviews.info.minVisits.title'),
          body: t('admin.reviews.info.minVisits.body'),
        },
        delay: {
          title: t('admin.reviews.info.delay.title'),
          body: t('admin.reviews.info.delay.body'),
        },
        maxSnoozes: {
          title: t('admin.reviews.info.maxSnoozes.title'),
          body: t('admin.reviews.info.maxSnoozes.body'),
        },
        snoozeHours: {
          title: t('admin.reviews.info.snoozeHours.title'),
          body: t('admin.reviews.info.snoozeHours.body'),
        },
        metrics: {
          title: t('admin.reviews.info.metrics.title'),
          body: t('admin.reviews.info.metrics.body'),
        },
      }) as const,
    [copy.location.definiteSingular, copy.location.fromWithDefinite, t],
  );

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
      title: t('admin.reviews.toast.loadErrorTitle'),
      description: t('admin.reviews.toast.tryAgain'),
      variant: 'destructive',
    });
  }, [configQuery.error, metricsQuery.error, t, toast]);

  useEffect(() => {
    if (!feedbackQuery.error) return;
    toast({
      title: t('admin.reviews.toast.loadFeedbackErrorTitle'),
      description: t('admin.reviews.toast.tryAgain'),
      variant: 'destructive',
    });
  }, [feedbackQuery.error, t, toast]);

  const metrics = metricsQuery.data ?? null;
  const feedback = feedbackQuery.data ?? EMPTY_FEEDBACK;
  const isLoading = configQuery.isLoading || metricsQuery.isLoading || !config;
  const reviewConfigEntityId = config?.localId;

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
        title: t('admin.reviews.toast.savedTitle'),
        description: t('admin.reviews.toast.savedDescription'),
      });
    } catch (error) {
      toast({
        title: t('admin.reviews.toast.saveErrorTitle'),
        description: error instanceof Error ? error.message : t('admin.reviews.toast.reviewData'),
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
        title: t('admin.reviews.toast.feedbackResolvedTitle'),
        description: t('admin.reviews.toast.feedbackResolvedDescription'),
      });
    } catch (error) {
      toast({
        title: t('admin.reviews.toast.resolveErrorTitle'),
        description: error instanceof Error ? error.message : t('admin.reviews.toast.tryAgain'),
        variant: 'destructive',
      });
    }
  };

  const metricsCards = useMemo(() => {
    if (!metrics) return [];
    return [
      { label: t('admin.reviews.metrics.requests'), value: metrics.createdCount },
      { label: t('admin.reviews.metrics.shown'), value: metrics.shownCount },
      { label: t('admin.reviews.metrics.rated'), value: metrics.ratedCount },
      { label: t('admin.reviews.metrics.googleClicks'), value: metrics.googleClicksCount },
      { label: t('admin.reviews.metrics.privateFeedback'), value: metrics.feedbackCount },
      { label: t('admin.reviews.metrics.conversion'), value: `${(metrics.conversionRate * 100).toFixed(1)}%` },
    ];
  }, [metrics, t]);

  if (isLoading || !config) {
    return <div className="text-muted-foreground">{t('admin.reviews.loading')}</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="pl-12 md:pl-0">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground">{t('admin.reviews.title')}</h1>
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t('admin.reviews.aria.metricsInfo')}
              onClick={() => openInfo('metrics')}
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
          <p className="text-muted-foreground">
            {t('admin.reviews.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t('admin.reviews.filters.from')}</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t('admin.reviews.filters.to')}</span>
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
          <TabsTrigger value="config">{t('admin.reviews.tabs.config')}</TabsTrigger>
          <TabsTrigger value="feedback">{t('admin.reviews.tabs.feedback')}</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>{t('admin.reviews.program.title')}</CardTitle>
              <CardDescription>
                {t('admin.reviews.program.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('admin.reviews.fields.enable')}</p>
                  <p className="text-xs text-muted-foreground">{t('admin.reviews.fields.enableHint')}</p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) => updateConfigField('enabled', checked)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('admin.reviews.fields.googleUrl')}</Label>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={t('admin.reviews.aria.googleUrlInfo')}
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
                    <Label>{t('admin.reviews.fields.cooldownDays')}</Label>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={t('admin.reviews.aria.cooldownInfo')}
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
                    <Label>{t('admin.reviews.fields.minVisits')}</Label>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={t('admin.reviews.aria.minVisitsInfo')}
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
                    <Label>{t('admin.reviews.fields.delayMinutes')}</Label>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={t('admin.reviews.aria.delayInfo')}
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
                    <Label>{t('admin.reviews.fields.maxSnoozes')}</Label>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={t('admin.reviews.aria.maxSnoozesInfo')}
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
                    <Label>{t('admin.reviews.fields.snoozeHours')}</Label>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={t('admin.reviews.aria.snoozeHoursInfo')}
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
                  <p className="text-sm font-semibold text-foreground">{t('admin.reviews.modalCopy.title')}</p>
                  <p className="text-xs text-muted-foreground">{t('admin.reviews.modalCopy.description')}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>{t('admin.reviews.modalCopy.fields.title')}</Label>
                      <InlineTranslationPopover
                        entityType="review_config"
                        entityId={reviewConfigEntityId}
                        fieldKey="copyJson.title"
                        onUpdated={async () => {
                          await configQuery.refetch();
                        }}
                      />
                    </div>
                    <Input
                      value={config.copyJson.title}
                      onChange={(e) =>
                        updateConfigField('copyJson', { ...config.copyJson, title: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>{t('admin.reviews.modalCopy.fields.subtitle')}</Label>
                      <InlineTranslationPopover
                        entityType="review_config"
                        entityId={reviewConfigEntityId}
                        fieldKey="copyJson.subtitle"
                        onUpdated={async () => {
                          await configQuery.refetch();
                        }}
                      />
                    </div>
                    <Textarea
                      value={config.copyJson.subtitle}
                      onChange={(e) =>
                        updateConfigField('copyJson', { ...config.copyJson, subtitle: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>{t('admin.reviews.modalCopy.fields.positiveText')}</Label>
                      <InlineTranslationPopover
                        entityType="review_config"
                        entityId={reviewConfigEntityId}
                        fieldKey="copyJson.positiveText"
                        onUpdated={async () => {
                          await configQuery.refetch();
                        }}
                      />
                    </div>
                    <Textarea
                      value={config.copyJson.positiveText}
                      onChange={(e) =>
                        updateConfigField('copyJson', { ...config.copyJson, positiveText: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>{t('admin.reviews.modalCopy.fields.negativeText')}</Label>
                      <InlineTranslationPopover
                        entityType="review_config"
                        entityId={reviewConfigEntityId}
                        fieldKey="copyJson.negativeText"
                        onUpdated={async () => {
                          await configQuery.refetch();
                        }}
                      />
                    </div>
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
                  {isSaving ? t('admin.common.saving') : t('admin.services.actions.saveChanges')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4">
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>{t('admin.reviews.feedback.title')}</CardTitle>
              <CardDescription>
                {t('admin.reviews.feedback.description')}
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
                    {status === 'OPEN'
                      ? t('admin.reviews.feedback.status.open')
                      : status === 'RESOLVED'
                        ? t('admin.reviews.feedback.status.resolved')
                        : t('admin.reviews.feedback.status.all')}
                  </Button>
                ))}
              </div>

              {feedback.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('admin.reviews.feedback.empty')}</p>
              ) : (
                <div className="space-y-3">
                  {feedback.items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">
                            {item.clientName || item.guestContact || t('admin.common.guest')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.serviceName || t('admin.common.table.service')} · {item.barberName || copy.staff.singular}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.appointmentDate
                              ? new Date(item.appointmentDate).toLocaleString(
                                  language.startsWith('en') ? 'en-US' : 'es-ES',
                                )
                              : ''}
                          </p>
                        </div>
                        <Badge variant={item.feedbackStatus === 'OPEN' ? 'destructive' : 'secondary'}>
                          {item.feedbackStatus === 'OPEN'
                            ? t('admin.reviews.feedback.status.open')
                            : t('admin.reviews.feedback.status.resolved')}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm text-foreground/90">{item.privateFeedback}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {t('admin.reviews.feedback.rating', { rating: item.rating ?? '-' })}
                        </span>
                        {item.feedbackStatus === 'OPEN' && (
                          <Button size="sm" onClick={() => handleResolve(item.id)}>
                            {t('admin.reviews.actions.markResolved')}
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
            <DialogTitle>{infoKey ? infoContent[infoKey].title : t('admin.alerts.type.info')}</DialogTitle>
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
