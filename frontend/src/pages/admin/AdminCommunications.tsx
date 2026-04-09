import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  Loader2,
  Megaphone,
  Send,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { useAdminPermissions } from '@/context/AdminPermissionsContext';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/useI18n';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { getAdminBarbers } from '@/data/api/barbers';
import { getAppointmentsPage } from '@/data/api/appointments';
import {
  cancelScheduledCommunication,
  createCommunication,
  duplicateCommunication,
  executeCommunication,
  getCommunicationChannelPreference,
  getCommunicationDetail,
  getCommunicationTemplates,
  listCommunications,
  previewCommunication,
} from '@/data/api/communications';
import {
  CommunicationCampaignDetail,
  CommunicationChannel,
  CommunicationPayload,
  CommunicationPreviewResult,
  CommunicationScopeType,
  CommunicationTemplate,
} from '@/data/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

const DEFAULT_SCOPE: CommunicationScopeType = 'all_day';
const SCOPES_REQUIRING_DATE: CommunicationScopeType[] = [
  'all_day',
  'appointments_morning',
  'appointments_afternoon',
  'day_time_range',
  'professional_single',
  'professional_multi',
  'appointment_selection',
];

const toDatetimeLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const toIsoStringOrUndefined = (value?: string) => {
  const raw = (value || '').trim();
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

const normalizeOptionsForForm = (payload?: CommunicationPayload['extraOptions']) => {
  if (!payload) return payload;
  const holiday = payload.createHoliday;
  if (!holiday) return payload;
  return {
    ...payload,
    createHoliday: {
      ...holiday,
      start: toDatetimeLocalInput(holiday.start),
      end: toDatetimeLocalInput(holiday.end),
    },
  };
};

const buildDefaultForm = (channel: CommunicationChannel): CommunicationPayload => ({
  actionType: 'solo_comunicar',
  scopeType: DEFAULT_SCOPE,
  scopeCriteria: {
    date: new Date().toISOString().slice(0, 10),
    barberIds: [],
    appointmentIds: [],
  },
  templateKey: 'general_announcement',
  channel,
  title: '',
  subject: '',
  message: '',
  internalNote: '',
  extraOptions: {
    excludeAlreadyNotified: true,
    createHoliday: {
      enabled: false,
      type: 'general',
      start: '',
      end: '',
      barberId: '',
    },
  },
});

const AdminCommunications: React.FC = () => {
  const { currentLocationId, tenant } = useTenant();
  const { canAccessSection, hasPermission } = useAdminPermissions();
  const { toast } = useToast();
  const { t } = useI18n();
  const featureEnabled = tenant?.config?.features?.communicationsEnabled === true;
  const canViewCommunications = canAccessSection('communications');
  const canViewHistory = hasPermission('communications:view_history');
  const canCreateDraft = hasPermission('communications:create_draft');
  const canPreviewImpact = hasPermission('communications:preview');
  const canExecute = hasPermission('communications:execute');
  const canSchedule = hasPermission('communications:schedule');
  const canCancelScheduled = hasPermission('communications:cancel_scheduled');
  const canDuplicate = hasPermission('communications:duplicate');

  const [composerOpen, setComposerOpen] = useState(false);
  const [confirmExecuteOpen, setConfirmExecuteOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailCampaignId, setDetailCampaignId] = useState<string | null>(null);
  const [historyStatus, setHistoryStatus] = useState('all');
  const [historyPage, setHistoryPage] = useState(1);
  const [form, setForm] = useState<CommunicationPayload>(buildDefaultForm('email'));
  const [preview, setPreview] = useState<CommunicationPreviewResult | null>(null);
  const [previewFresh, setPreviewFresh] = useState(false);

  const templatesQuery = useQuery({
    queryKey: queryKeys.adminCommunicationTemplates(currentLocationId),
    queryFn: getCommunicationTemplates,
    enabled: featureEnabled && canViewCommunications,
  });
  const channelPreferenceQuery = useQuery({
    queryKey: queryKeys.adminCommunicationChannelPreference(currentLocationId),
    queryFn: getCommunicationChannelPreference,
    enabled: featureEnabled && canViewCommunications,
  });
  const barbersQuery = useQuery({
    queryKey: queryKeys.barbers(currentLocationId, undefined, true),
    queryFn: () => getAdminBarbers(),
    enabled: featureEnabled,
  });
  const appointmentsForSelectionQuery = useQuery({
    queryKey: queryKeys.adminSearchAppointments(
      currentLocationId,
      1,
      100,
      undefined,
      form.scopeCriteria.date || '',
      'asc',
    ),
    queryFn: () =>
      getAppointmentsPage({
        date: form.scopeCriteria.date,
        page: 1,
        pageSize: 100,
        sort: 'asc',
      }),
    enabled: featureEnabled && form.scopeType === 'appointment_selection' && Boolean(form.scopeCriteria.date),
  });
  const historyQuery = useQuery({
    queryKey: queryKeys.adminCommunications(currentLocationId, historyPage, 20, historyStatus),
    queryFn: () =>
      listCommunications({
        page: historyPage,
        pageSize: 20,
        status: historyStatus !== 'all' ? historyStatus : undefined,
      }),
    enabled: featureEnabled && canViewHistory,
  });
  const detailQuery = useQuery({
    queryKey: queryKeys.adminCommunicationDetail(currentLocationId, detailCampaignId),
    queryFn: () => getCommunicationDetail(detailCampaignId || ''),
    enabled: featureEnabled && canViewHistory && detailsOpen && Boolean(detailCampaignId),
  });

  useEffect(() => {
    if (!channelPreferenceQuery.data?.channel) return;
    setForm((prev) => ({ ...prev, channel: channelPreferenceQuery.data.channel }));
  }, [channelPreferenceQuery.data?.channel]);

  useEffect(() => {
    if (!templatesQuery.data?.length) return;
    if (form.title || form.message || form.subject) return;
    const selected = templatesQuery.data.find((template) => template.key === form.templateKey) || templatesQuery.data[0];
    setForm((prev) => ({
      ...prev,
      templateKey: selected.key,
      title: selected.title,
      subject: selected.subject,
      message: selected.message,
    }));
  }, [form.message, form.subject, form.templateKey, form.title, templatesQuery.data]);

  const previewMutation = useMutation({
    mutationFn: (payload: CommunicationPayload) => previewCommunication(payload),
    onSuccess: (result) => {
      setPreview(result);
      setPreviewFresh(true);
    },
    onError: (error) => {
      setPreviewFresh(false);
      toast({
        title: t('admin.common.error'),
        description: error instanceof Error ? error.message : t('admin.communications.toast.previewError'),
        variant: 'destructive',
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CommunicationPayload & { saveAsDraft?: boolean; executeNow?: boolean; idempotencyKey?: string }) =>
      createCommunication(payload),
    onSuccess: async (result) => {
      setComposerOpen(false);
      setConfirmExecuteOpen(false);
      setPreview(null);
      setPreviewFresh(false);
      setForm(buildDefaultForm(form.channel));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['communications', currentLocationId || 'default'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminCommunicationChannelPreference(currentLocationId) }),
      ]);
      toast({
        title: t('admin.communications.toast.createdTitle'),
        description: t('admin.communications.toast.createdDescription'),
      });
    },
    onError: (error) => {
      toast({
        title: t('admin.common.error'),
        description: error instanceof Error ? error.message : t('admin.communications.toast.createError'),
        variant: 'destructive',
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (campaignId: string) => duplicateCommunication(campaignId),
    onSuccess: async (result) => {
      setForm({
        actionType: result.actionType,
        scopeType: result.scopeType,
        scopeCriteria: result.scopeCriteria || {},
        templateKey: result.templateKey,
        channel: result.channel,
        title: result.title,
        subject: result.subject || '',
        message: result.message,
        internalNote: result.internalNote || '',
        scheduleAt: toDatetimeLocalInput(result.scheduledFor || undefined),
        extraOptions: normalizeOptionsForForm(result.options) || {
          excludeAlreadyNotified: true,
        },
      });
      setPreview(null);
      setPreviewFresh(false);
      setComposerOpen(true);
      await queryClient.invalidateQueries({ queryKey: ['communications', currentLocationId || 'default'] });
      toast({
        title: t('admin.communications.toast.duplicatedTitle'),
        description: t('admin.communications.toast.duplicatedDescription'),
      });
    },
    onError: (error) => {
      toast({
        title: t('admin.common.error'),
        description: error instanceof Error ? error.message : t('admin.communications.toast.duplicateError'),
        variant: 'destructive',
      });
    },
  });

  const cancelScheduledMutation = useMutation({
    mutationFn: (campaignId: string) => cancelScheduledCommunication(campaignId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['communications', currentLocationId || 'default'] });
      toast({
        title: t('admin.communications.toast.cancelScheduleTitle'),
        description: t('admin.communications.toast.cancelScheduleDescription'),
      });
    },
    onError: (error) => {
      toast({
        title: t('admin.common.error'),
        description: error instanceof Error ? error.message : t('admin.communications.toast.cancelScheduleError'),
        variant: 'destructive',
      });
    },
  });

  const executeExistingMutation = useMutation({
    mutationFn: (campaignId: string) => executeCommunication(campaignId, crypto.randomUUID()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['communications', currentLocationId || 'default'] });
      toast({
        title: t('admin.communications.toast.executedTitle'),
        description: t('admin.communications.toast.executedDescription'),
      });
    },
    onError: (error) => {
      toast({
        title: t('admin.common.error'),
        description: error instanceof Error ? error.message : t('admin.communications.toast.executeError'),
        variant: 'destructive',
      });
    },
  });

  const templates = templatesQuery.data || [];
  const history = historyQuery.data;
  const historyItems = history?.items || [];

  const manualSelectableAppointments = useMemo(
    () => appointmentsForSelectionQuery.data?.items || [],
    [appointmentsForSelectionQuery.data?.items],
  );

  if (!featureEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.communications.disabled.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('admin.communications.disabled.description')}</p>
        </CardContent>
      </Card>
    );
  }

  if (!canViewCommunications) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.restricted.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('admin.restricted.description')}</p>
        </CardContent>
      </Card>
    );
  }

  const applyTemplate = (templateKey: string) => {
    const selectedTemplate = templates.find((template) => template.key === templateKey) || null;
    if (!selectedTemplate) return;
    setForm((prev) => ({
      ...prev,
      templateKey: selectedTemplate.key,
      title: selectedTemplate.title,
      subject: selectedTemplate.subject,
      message: selectedTemplate.message,
    }));
    setPreviewFresh(false);
  };

  const updateScopeType = (scopeType: CommunicationScopeType) => {
    setForm((prev) => ({
      ...prev,
      scopeType,
      scopeCriteria: {
        ...prev.scopeCriteria,
        appointmentIds: [],
      },
    }));
    setPreviewFresh(false);
  };

  const triggerPreview = async () => {
    if (!canPreviewImpact) return;
    const normalized = normalizePayloadForApi(form);
    await previewMutation.mutateAsync(normalized);
  };

  const handleSaveDraft = async () => {
    if (!canCreateDraft) return;
    await createMutation.mutateAsync({
      ...normalizePayloadForApi(form),
      saveAsDraft: true,
    });
  };

  const handleSchedule = async () => {
    if (!canCreateDraft || !canSchedule) return;
    await createMutation.mutateAsync({
      ...normalizePayloadForApi(form),
      saveAsDraft: false,
      executeNow: false,
    });
  };

  const openExecuteConfirmation = async () => {
    if (!canExecute) return;
    if (!previewFresh && canPreviewImpact) {
      await triggerPreview();
    }
    setConfirmExecuteOpen(true);
  };

  const handleExecuteNow = async () => {
    if (!canCreateDraft || !canExecute) return;
    await createMutation.mutateAsync({
      ...normalizePayloadForApi(form),
      executeNow: true,
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const statusBadge = (status: string) => {
    if (status === 'completed') return <Badge>{t('admin.communications.status.completed')}</Badge>;
    if (status === 'partial') return <Badge variant="secondary">{t('admin.communications.status.partial')}</Badge>;
    if (status === 'scheduled') return <Badge variant="outline">{t('admin.communications.status.scheduled')}</Badge>;
    if (status === 'draft') return <Badge variant="outline">{t('admin.communications.status.draft')}</Badge>;
    if (status === 'cancelled') return <Badge variant="destructive">{t('admin.communications.status.cancelled')}</Badge>;
    if (status === 'running') return <Badge variant="secondary">{t('admin.communications.status.running')}</Badge>;
    return <Badge variant="destructive">{t('admin.communications.status.failed')}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 pl-12 md:pl-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('admin.communications.title')}</h1>
          <p className="text-muted-foreground">{t('admin.communications.subtitle')}</p>
        </div>
        <Button onClick={() => setComposerOpen(true)} disabled={!canCreateDraft}>
          <Megaphone className="mr-2 h-4 w-4" />
          {t('admin.communications.actions.new')}
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('admin.communications.history.title')}</CardTitle>
          <Select
            value={historyStatus}
            onValueChange={(value) => {
              setHistoryStatus(value);
              setHistoryPage(1);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.communications.filters.all')}</SelectItem>
              <SelectItem value="draft">{t('admin.communications.status.draft')}</SelectItem>
              <SelectItem value="scheduled">{t('admin.communications.status.scheduled')}</SelectItem>
              <SelectItem value="completed">{t('admin.communications.status.completed')}</SelectItem>
              <SelectItem value="partial">{t('admin.communications.status.partial')}</SelectItem>
              <SelectItem value="failed">{t('admin.communications.status.failed')}</SelectItem>
              <SelectItem value="cancelled">{t('admin.communications.status.cancelled')}</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-3">
          {!canViewHistory ? (
            <p className="text-sm text-muted-foreground">{t('admin.restricted.description')}</p>
          ) : historyQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : historyItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('admin.communications.history.empty')}</p>
          ) : (
            historyItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{item.title}</p>
                      {statusBadge(item.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('admin.communications.history.meta', {
                        channel: t(`admin.communications.channel.${item.channel}`),
                        scope: t(`admin.communications.scope.${item.scopeType}`),
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDetailCampaignId(item.id);
                        setDetailsOpen(true);
                      }}
                    >
                      <Eye className="mr-1 h-4 w-4" />
                      {t('admin.communications.actions.view')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => duplicateMutation.mutate(item.id)}
                      disabled={duplicateMutation.isPending || !canDuplicate}
                    >
                      <Copy className="mr-1 h-4 w-4" />
                      {t('admin.communications.actions.duplicate')}
                    </Button>
                    {(item.status === 'draft' || item.status === 'scheduled') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => executeExistingMutation.mutate(item.id)}
                        disabled={executeExistingMutation.isPending || !canExecute}
                      >
                        <Send className="mr-1 h-4 w-4" />
                        {t('admin.communications.actions.execute')}
                      </Button>
                    )}
                    {item.status === 'scheduled' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => cancelScheduledMutation.mutate(item.id)}
                        disabled={cancelScheduledMutation.isPending || !canCancelScheduled}
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        {t('admin.communications.actions.cancelSchedule')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          {canViewHistory && history && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                disabled={history.page <= 1}
              >
                {t('admin.communications.pagination.prev')}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t('admin.communications.pagination.page', { page: history.page })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryPage((prev) => prev + 1)}
                disabled={!history.hasMore}
              >
                {t('admin.communications.pagination.next')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('admin.communications.composer.title')}</DialogTitle>
            <DialogDescription>{t('admin.communications.composer.description')}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            <section className="space-y-2">
              <Label>{t('admin.communications.form.actionType')}</Label>
              <Select
                value={form.actionType}
                onValueChange={(value: CommunicationPayload['actionType']) => {
                  const next = {
                    ...form,
                    actionType: value,
                    scheduleAt: value === 'comunicar_y_cancelar' ? undefined : form.scheduleAt,
                    scopeType: value === 'comunicar_y_cancelar' && form.scopeType === 'all_clients' ? 'all_day' : form.scopeType,
                  };
                  setForm(next);
                  setPreviewFresh(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solo_comunicar">{t('admin.communications.action.solo_comunicar')}</SelectItem>
                  <SelectItem value="comunicar_y_cancelar">{t('admin.communications.action.comunicar_y_cancelar')}</SelectItem>
                </SelectContent>
              </Select>
            </section>

            <section className="space-y-2">
              <Label>{t('admin.communications.form.scope')}</Label>
              <Select value={form.scopeType} onValueChange={(value: CommunicationScopeType) => updateScopeType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_day">{t('admin.communications.scope.all_day')}</SelectItem>
                  <SelectItem value="appointments_morning">{t('admin.communications.scope.appointments_morning')}</SelectItem>
                  <SelectItem value="appointments_afternoon">{t('admin.communications.scope.appointments_afternoon')}</SelectItem>
                  <SelectItem value="day_time_range">{t('admin.communications.scope.day_time_range')}</SelectItem>
                  <SelectItem value="professional_single">{t('admin.communications.scope.professional_single')}</SelectItem>
                  <SelectItem value="professional_multi">{t('admin.communications.scope.professional_multi')}</SelectItem>
                  <SelectItem value="appointment_selection">{t('admin.communications.scope.appointment_selection')}</SelectItem>
                  <SelectItem value="all_clients" disabled={form.actionType === 'comunicar_y_cancelar'}>
                    {t('admin.communications.scope.all_clients')}
                  </SelectItem>
                </SelectContent>
              </Select>

              <div className="grid gap-3 md:grid-cols-3">
                {SCOPES_REQUIRING_DATE.includes(form.scopeType) && (
                  <div className="space-y-1">
                    <Label>{t('admin.communications.form.date')}</Label>
                    <Input
                      type="date"
                      value={form.scopeCriteria.date || ''}
                      onChange={(e) => {
                        setForm((prev) => ({
                          ...prev,
                          scopeCriteria: {
                            ...prev.scopeCriteria,
                            date: e.target.value,
                          },
                        }));
                        setPreviewFresh(false);
                      }}
                    />
                  </div>
                )}
                {form.scopeType === 'day_time_range' && (
                  <>
                    <div className="space-y-1">
                      <Label>{t('admin.communications.form.startTime')}</Label>
                      <Input
                        type="time"
                        value={form.scopeCriteria.startTime || ''}
                        onChange={(e) => {
                          setForm((prev) => ({
                            ...prev,
                            scopeCriteria: {
                              ...prev.scopeCriteria,
                              startTime: e.target.value,
                            },
                          }));
                          setPreviewFresh(false);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('admin.communications.form.endTime')}</Label>
                      <Input
                        type="time"
                        value={form.scopeCriteria.endTime || ''}
                        onChange={(e) => {
                          setForm((prev) => ({
                            ...prev,
                            scopeCriteria: {
                              ...prev.scopeCriteria,
                              endTime: e.target.value,
                            },
                          }));
                          setPreviewFresh(false);
                        }}
                      />
                    </div>
                  </>
                )}
              </div>

              {(form.scopeType === 'professional_single' || form.scopeType === 'professional_multi') && (
                <div className="space-y-2">
                  {form.scopeType === 'professional_single' ? (
                    <Select
                      value={form.scopeCriteria.barberId || ''}
                      onValueChange={(barberId) => {
                        setForm((prev) => ({
                          ...prev,
                          scopeCriteria: {
                            ...prev.scopeCriteria,
                            barberId,
                          },
                        }));
                        setPreviewFresh(false);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('admin.communications.form.selectBarber')} />
                      </SelectTrigger>
                      <SelectContent>
                        {(barbersQuery.data || []).map((barber) => (
                          <SelectItem key={barber.id} value={barber.id}>
                            {barber.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-2 rounded-xl border border-border/60 p-3">
                      {(barbersQuery.data || []).map((barber) => {
                        const selected = form.scopeCriteria.barberIds?.includes(barber.id) || false;
                        return (
                          <label key={barber.id} className="flex items-center justify-between rounded-lg border border-border/50 px-2 py-1.5">
                            <span className="text-sm">{barber.name}</span>
                            <Switch
                              checked={selected}
                              onCheckedChange={(checked) => {
                                setForm((prev) => {
                                  const ids = new Set(prev.scopeCriteria.barberIds || []);
                                  if (checked) ids.add(barber.id);
                                  else ids.delete(barber.id);
                                  return {
                                    ...prev,
                                    scopeCriteria: {
                                      ...prev.scopeCriteria,
                                      barberIds: Array.from(ids),
                                    },
                                  };
                                });
                                setPreviewFresh(false);
                              }}
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {form.scopeType === 'appointment_selection' && (
                <div className="rounded-xl border border-border/60 p-3 space-y-2">
                  {appointmentsForSelectionQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('admin.communications.form.loadingAppointments')}
                    </div>
                  ) : manualSelectableAppointments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('admin.communications.form.noAppointments')}</p>
                  ) : (
                    <div className="grid gap-2">
                      {manualSelectableAppointments.map((appointment) => {
                        const selected = form.scopeCriteria.appointmentIds?.includes(appointment.id) || false;
                        const time = new Date(appointment.startDateTime).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        return (
                          <label key={appointment.id} className="flex items-center justify-between rounded-lg border border-border/50 px-2 py-1.5">
                            <span className="text-sm">
                              {time} · {appointment.guestName || appointment.serviceNameSnapshot || appointment.serviceId}
                            </span>
                            <Switch
                              checked={selected}
                              onCheckedChange={(checked) => {
                                setForm((prev) => {
                                  const ids = new Set(prev.scopeCriteria.appointmentIds || []);
                                  if (checked) ids.add(appointment.id);
                                  else ids.delete(appointment.id);
                                  return {
                                    ...prev,
                                    scopeCriteria: {
                                      ...prev.scopeCriteria,
                                      appointmentIds: Array.from(ids),
                                    },
                                  };
                                });
                                setPreviewFresh(false);
                              }}
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('admin.communications.form.template')}</Label>
                <Select value={form.templateKey} onValueChange={(value) => applyTemplate(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template: CommunicationTemplate) => (
                      <SelectItem key={template.key} value={template.key}>
                        {template.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('admin.communications.form.channel')}</Label>
                <Select
                  value={form.channel}
                  onValueChange={(value: CommunicationChannel) => {
                    setForm((prev) => ({ ...prev, channel: value }));
                    setPreviewFresh(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">{t('admin.communications.channel.email')}</SelectItem>
                    <SelectItem value="sms">{t('admin.communications.channel.sms')}</SelectItem>
                    <SelectItem value="whatsapp">{t('admin.communications.channel.whatsapp')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="space-y-2">
              <Label>{t('admin.communications.form.title')}</Label>
              <Input
                value={form.title}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, title: e.target.value }));
                  setPreviewFresh(false);
                }}
              />
              <Label>{t('admin.communications.form.subject')}</Label>
              <Input
                value={form.subject || ''}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, subject: e.target.value }));
                  setPreviewFresh(false);
                }}
              />
              <Label>{t('admin.communications.form.message')}</Label>
              <Textarea
                rows={8}
                value={form.message}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, message: e.target.value }));
                  setPreviewFresh(false);
                }}
              />
              <Label>{t('admin.communications.form.internalNote')}</Label>
              <Textarea
                rows={2}
                value={form.internalNote || ''}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, internalNote: e.target.value }));
                }}
              />
            </section>

            <section className="space-y-3 rounded-xl border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t('admin.communications.form.excludeAlreadyNotified')}</p>
                  <p className="text-xs text-muted-foreground">{t('admin.communications.form.excludeAlreadyNotifiedHint')}</p>
                </div>
                <Switch
                  checked={form.extraOptions?.excludeAlreadyNotified !== false}
                  onCheckedChange={(checked) => {
                    setForm((prev) => ({
                      ...prev,
                      extraOptions: {
                        ...prev.extraOptions,
                        excludeAlreadyNotified: checked,
                      },
                    }));
                    setPreviewFresh(false);
                  }}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t('admin.communications.form.schedule')}</p>
                    <p className="text-xs text-muted-foreground">{t('admin.communications.form.scheduleHint')}</p>
                  </div>
                  {form.actionType === 'comunicar_y_cancelar' && (
                    <Badge variant="destructive">{t('admin.communications.form.immediateOnly')}</Badge>
                  )}
                </div>
                    <Input
                      type="datetime-local"
                      value={form.scheduleAt || ''}
                  disabled={form.actionType === 'comunicar_y_cancelar'}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({ ...prev, scheduleAt: value || undefined }));
                    setPreviewFresh(false);
                  }}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{t('admin.communications.form.createHoliday')}</p>
                  <Switch
                    checked={form.extraOptions?.createHoliday?.enabled === true}
                    onCheckedChange={(checked) => {
                      setForm((prev) => ({
                        ...prev,
                        extraOptions: {
                          ...prev.extraOptions,
                          createHoliday: {
                            ...(prev.extraOptions?.createHoliday || {}),
                            enabled: checked,
                          },
                        },
                      }));
                      setPreviewFresh(false);
                    }}
                  />
                </div>
                {form.extraOptions?.createHoliday?.enabled && (
                  <div className="grid gap-2 md:grid-cols-3">
                    <Select
                      value={form.extraOptions?.createHoliday?.type || 'general'}
                      onValueChange={(value: 'general' | 'barber') => {
                        setForm((prev) => ({
                          ...prev,
                          extraOptions: {
                            ...prev.extraOptions,
                            createHoliday: {
                              ...(prev.extraOptions?.createHoliday || {}),
                              type: value,
                            },
                          },
                        }));
                        setPreviewFresh(false);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">{t('admin.communications.form.holidayType.general')}</SelectItem>
                        <SelectItem value="barber">{t('admin.communications.form.holidayType.barber')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="datetime-local"
                      value={form.extraOptions?.createHoliday?.start || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          extraOptions: {
                            ...prev.extraOptions,
                            createHoliday: {
                              ...(prev.extraOptions?.createHoliday || {}),
                              start: value,
                            },
                          },
                        }));
                        setPreviewFresh(false);
                      }}
                    />
                    <Input
                      type="datetime-local"
                      value={form.extraOptions?.createHoliday?.end || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          extraOptions: {
                            ...prev.extraOptions,
                            createHoliday: {
                              ...(prev.extraOptions?.createHoliday || {}),
                              end: value,
                            },
                          },
                        }));
                        setPreviewFresh(false);
                      }}
                    />
                    {form.extraOptions?.createHoliday?.type === 'barber' && (
                      <div className="md:col-span-3">
                        <Select
                          value={form.extraOptions?.createHoliday?.barberId || ''}
                          onValueChange={(value) => {
                            setForm((prev) => ({
                              ...prev,
                              extraOptions: {
                                ...prev.extraOptions,
                                createHoliday: {
                                  ...(prev.extraOptions?.createHoliday || {}),
                                  barberId: value,
                                },
                              },
                            }));
                            setPreviewFresh(false);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('admin.communications.form.selectBarber')} />
                          </SelectTrigger>
                          <SelectContent>
                            {(barbersQuery.data || []).map((barber) => (
                              <SelectItem key={barber.id} value={barber.id}>
                                {barber.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {preview && (
              <section className="rounded-xl border border-border/60 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <p className="font-medium">{t('admin.communications.preview.title')}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div className="rounded-lg border border-border/60 p-2">
                    <p className="text-xs text-muted-foreground">{t('admin.communications.preview.appointments')}</p>
                    <p className="font-semibold">{preview.appointmentsAffected}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-2">
                    <p className="text-xs text-muted-foreground">{t('admin.communications.preview.clients')}</p>
                    <p className="font-semibold">{preview.clientsAffected}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-2">
                    <p className="text-xs text-muted-foreground">{t('admin.communications.preview.cancellations')}</p>
                    <p className="font-semibold">{preview.cancellations}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-2">
                    <p className="text-xs text-muted-foreground">{t('admin.communications.preview.invalid')}</p>
                    <p className="font-semibold">{preview.withoutValidContact}</p>
                  </div>
                </div>
                {preview.excludedAlreadyNotified > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t('admin.communications.preview.excluded', { count: preview.excludedAlreadyNotified })}
                  </p>
                )}
              </section>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setComposerOpen(false)}>
              {t('appointmentEditor.cancel')}
            </Button>
            <Button
              variant="outline"
              onClick={triggerPreview}
              disabled={previewMutation.isPending || !canPreviewImpact}
            >
              {previewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Eye className="mr-2 h-4 w-4" />
              {t('admin.communications.actions.preview')}
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={createMutation.isPending || !canCreateDraft}
            >
              <Clock3 className="mr-2 h-4 w-4" />
              {t('admin.communications.actions.saveDraft')}
            </Button>
            <Button
              variant="outline"
              onClick={handleSchedule}
              disabled={
                createMutation.isPending ||
                form.actionType === 'comunicar_y_cancelar' ||
                !form.scheduleAt ||
                !canCreateDraft ||
                !canSchedule
              }
            >
              <CalendarClock className="mr-2 h-4 w-4" />
              {t('admin.communications.actions.schedule')}
            </Button>
            <Button
              onClick={openExecuteConfirmation}
              disabled={createMutation.isPending || !canCreateDraft || !canExecute}
            >
              <Send className="mr-2 h-4 w-4" />
              {t('admin.communications.actions.executeNow')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmExecuteOpen} onOpenChange={setConfirmExecuteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.communications.confirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {form.actionType === 'comunicar_y_cancelar'
                ? t('admin.communications.confirm.cancelWarning')
                : t('admin.communications.confirm.standardWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {preview && (
            <div className="rounded-xl border border-border/60 p-3 text-sm space-y-1">
              <p>{t('admin.communications.confirm.clients', { count: preview.clientsAffected })}</p>
              <p>{t('admin.communications.confirm.appointments', { count: preview.appointmentsAffected })}</p>
              {form.actionType === 'comunicar_y_cancelar' && (
                <p className="text-destructive">
                  {t('admin.communications.confirm.cancellations', { count: preview.cancellations })}
                </p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('appointmentEditor.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleExecuteNow}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('admin.communications.actions.executeConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('admin.communications.detail.title')}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {detailQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : !detailQuery.data ? (
              <p className="text-sm text-muted-foreground">{t('admin.communications.detail.empty')}</p>
            ) : (
              <CommunicationDetailView data={detailQuery.data} t={t} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const CommunicationDetailView: React.FC<{
  data: CommunicationCampaignDetail;
  t: (key: string, values?: Record<string, string | number>) => string;
}> = ({ data, t }) => (
  <div className="space-y-3">
    <Card>
      <CardContent className="pt-6 space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{t(`admin.communications.status.${data.status}`)}</Badge>
          <Badge variant="outline">{t(`admin.communications.channel.${data.channel}`)}</Badge>
          <Badge variant="outline">{t(`admin.communications.scope.${data.scopeType}`)}</Badge>
        </div>
        <p className="font-semibold">{data.title}</p>
        {data.subject && <p className="text-muted-foreground">{data.subject}</p>}
        <p className="whitespace-pre-wrap">{data.message}</p>
        {data.internalNote && (
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-2 text-xs">
            <p className="font-medium">{t('admin.communications.detail.internalNote')}</p>
            <p>{data.internalNote}</p>
          </div>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('admin.communications.detail.executions')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.executions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.communications.detail.noExecutions')}</p>
        ) : (
          data.executions.map((execution) => (
            <div key={execution.id} className="rounded-lg border border-border/60 p-2 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <p className="font-medium">{execution.id}</p>
                <Badge variant="outline">{execution.status}</Badge>
              </div>
              <p className="text-muted-foreground">
                {execution.startedAt}
                {execution.finishedAt ? ` · ${execution.finishedAt}` : ''}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('admin.communications.detail.recipientResults')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.recipientResults.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.communications.detail.noRecipients')}</p>
        ) : (
          data.recipientResults.map((recipient) => (
            <div key={recipient.id} className="rounded-lg border border-border/60 p-2 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <p className="font-medium">{recipient.recipientName || '-'}</p>
                {recipient.status === 'sent' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : recipient.status === 'excluded' ? (
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
              </div>
              <p className="text-muted-foreground">
                {recipient.recipientEmail || recipient.recipientPhone || '-'} · {recipient.channel}
              </p>
              {recipient.errorMessage && <p className="text-destructive">{recipient.errorMessage}</p>}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  </div>
);

const normalizePayloadForApi = (payload: CommunicationPayload): CommunicationPayload => {
  const holiday = payload.extraOptions?.createHoliday;
  return {
    ...payload,
    scheduleAt: toIsoStringOrUndefined(payload.scheduleAt),
    extraOptions: payload.extraOptions
      ? {
          ...payload.extraOptions,
          createHoliday: holiday
            ? {
                ...holiday,
                start: toIsoStringOrUndefined(holiday.start),
                end: toIsoStringOrUndefined(holiday.end),
              }
            : undefined,
        }
      : undefined,
  };
};

export default AdminCommunications;
