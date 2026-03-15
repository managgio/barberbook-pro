import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { CalendarDays, Loader2, Pencil, Plus, Repeat, Search, Trash2, User as UserIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { queryKeys } from '@/lib/queryKeys';
import {
  archiveSubscriptionPlan,
  assignUserSubscription,
  createSubscriptionPlan,
  getSubscriptionPlans,
  getUserActiveSubscription,
  getUserSubscriptions,
  markUserSubscriptionPaid,
  updateSubscriptionPlan,
} from '@/data/api/subscriptions';
import { getUserById, getUsersPage } from '@/data/api/users';
import { SubscriptionDurationUnit, SubscriptionPlan, User, UserSubscription } from '@/data/types';
import EmptyState from '@/components/common/EmptyState';
import { CardSkeleton } from '@/components/common/Skeleton';
import { useI18n } from '@/hooks/useI18n';
import { resolveDateLocale } from '@/lib/i18n';
import InlineTranslationPopover from '@/components/admin/InlineTranslationPopover';

const EMPTY_PLANS: SubscriptionPlan[] = [];
const EMPTY_CLIENTS: User[] = [];
const EMPTY_SUBSCRIPTIONS: UserSubscription[] = [];
const CLIENTS_PAGE_SIZE = 10;
const SUBSCRIPTIONS_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const DURATION_UNIT_KEYS: Record<SubscriptionDurationUnit, string> = {
  days: 'admin.subscriptions.durationUnit.days',
  weeks: 'admin.subscriptions.durationUnit.weeks',
  months: 'admin.subscriptions.durationUnit.months',
};

const statusVariant: Record<UserSubscription['status'], 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  cancelled: 'outline',
  expired: 'secondary',
};

const STATUS_LABEL_KEYS: Record<UserSubscription['status'], string> = {
  active: 'admin.subscriptions.status.active',
  cancelled: 'admin.subscriptions.status.cancelled',
  expired: 'admin.subscriptions.status.expired',
};

const paymentStatusVariant: Record<
  UserSubscription['paymentStatus'],
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  paid: 'default',
  in_person: 'outline',
  pending: 'secondary',
  failed: 'destructive',
  cancelled: 'secondary',
  exempt: 'outline',
};

const PAYMENT_STATUS_LABEL_KEYS: Record<UserSubscription['paymentStatus'], string> = {
  paid: 'admin.subscriptions.paymentStatus.paid',
  in_person: 'admin.subscriptions.paymentStatus.inPerson',
  pending: 'admin.subscriptions.paymentStatus.pending',
  failed: 'admin.subscriptions.paymentStatus.failed',
  cancelled: 'admin.subscriptions.paymentStatus.cancelled',
  exempt: 'admin.subscriptions.paymentStatus.exempt',
};

const AdminSubscriptions: React.FC = () => {
  const { toast } = useToast();
  const { t, language } = useI18n();
  const dateLocale = resolveDateLocale(language);
  const { currentLocationId } = useTenant();
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planToArchive, setPlanToArchive] = useState<SubscriptionPlan | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('none');
  const [clientsPage, setClientsPage] = useState(1);
  const [clientSearchDraft, setClientSearchDraft] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [subscriptionsPage, setSubscriptionsPage] = useState(1);
  const [markingPaidSubscriptionId, setMarkingPaidSubscriptionId] = useState<string | null>(null);
  const [assignClientsPage, setAssignClientsPage] = useState(1);
  const [assignClientSearchDraft, setAssignClientSearchDraft] = useState('');
  const [assignClientSearchTerm, setAssignClientSearchTerm] = useState('');
  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    price: '0',
    durationValue: '1',
    durationUnit: 'months' as SubscriptionDurationUnit,
    isActive: true,
    availabilityStartDate: '',
    availabilityEndDate: '',
    displayOrder: '0',
  });
  const [assignForm, setAssignForm] = useState({
    userId: 'none',
    planId: 'none',
    startDate: '',
    notes: '',
  });

  const plansQuery = useQuery({
    queryKey: queryKeys.subscriptionPlans(currentLocationId, false),
    queryFn: () => getSubscriptionPlans(false),
  });

  const clientsQuery = useQuery({
    queryKey: queryKeys.adminClients(currentLocationId, clientsPage, CLIENTS_PAGE_SIZE, clientSearchTerm),
    queryFn: () =>
      getUsersPage({ page: clientsPage, pageSize: CLIENTS_PAGE_SIZE, role: 'client', q: clientSearchTerm }),
    enabled: clientSearchTerm.length > 0,
  });

  const assignClientsQuery = useQuery({
    queryKey: queryKeys.adminClients(
      currentLocationId,
      assignClientsPage,
      CLIENTS_PAGE_SIZE,
      assignClientSearchTerm,
    ),
    queryFn: () =>
      getUsersPage({
        page: assignClientsPage,
        pageSize: CLIENTS_PAGE_SIZE,
        role: 'client',
        q: assignClientSearchTerm,
      }),
    enabled: isAssignDialogOpen && assignClientSearchTerm.length > 0,
  });

  const selectedClientQuery = useQuery({
    queryKey: ['user-by-id', currentLocationId || 'default', selectedClientId],
    queryFn: () => getUserById(selectedClientId),
    enabled: selectedClientId !== 'none',
  });

  const assignSelectedClientQuery = useQuery({
    queryKey: ['user-by-id', currentLocationId || 'default', assignForm.userId],
    queryFn: () => getUserById(assignForm.userId),
    enabled: isAssignDialogOpen && assignForm.userId !== 'none',
  });

  const userSubscriptionsQuery = useQuery({
    queryKey: queryKeys.userSubscriptions(
      currentLocationId,
      selectedClientId,
      subscriptionsPage,
      SUBSCRIPTIONS_PAGE_SIZE,
    ),
    queryFn: () =>
      getUserSubscriptions(selectedClientId, {
        page: subscriptionsPage,
        pageSize: SUBSCRIPTIONS_PAGE_SIZE,
      }),
    enabled: selectedClientId !== 'none',
  });

  const userActiveSubscriptionQuery = useQuery({
    queryKey: queryKeys.userActiveSubscription(currentLocationId, selectedClientId),
    queryFn: () => (selectedClientId !== 'none' ? getUserActiveSubscription(selectedClientId) : Promise.resolve(null)),
    enabled: selectedClientId !== 'none',
  });

  const plans = plansQuery.data ?? EMPTY_PLANS;
  const clients = clientsQuery.data?.items ?? EMPTY_CLIENTS;
  const assignClients = assignClientsQuery.data?.items ?? EMPTY_CLIENTS;
  const selectedClientSubscriptions = userSubscriptionsQuery.data?.items ?? EMPTY_SUBSCRIPTIONS;
  const activeSubscription = userActiveSubscriptionQuery.data ?? null;
  const selectedClient = selectedClientQuery.data ?? null;
  const assignSelectedClient = assignSelectedClientQuery.data ?? null;
  const subscriptionsTotal = userSubscriptionsQuery.data?.total ?? 0;
  const subscriptionsTotalPages = Math.max(
    1,
    Math.ceil(subscriptionsTotal / (userSubscriptionsQuery.data?.pageSize || SUBSCRIPTIONS_PAGE_SIZE)),
  );
  const clientsTotalPages = Math.max(
    1,
    Math.ceil((clientsQuery.data?.total ?? 0) / (clientsQuery.data?.pageSize || CLIENTS_PAGE_SIZE)),
  );
  const assignClientsTotalPages = Math.max(
    1,
    Math.ceil((assignClientsQuery.data?.total ?? 0) / (assignClientsQuery.data?.pageSize || CLIENTS_PAGE_SIZE)),
  );
  const activePlans = useMemo(
    () => plans.filter((plan) => !plan.isArchived && plan.isActive),
    [plans],
  );
  const durationUnitLabels = useMemo(
    () =>
      (Object.entries(DURATION_UNIT_KEYS) as Array<[SubscriptionDurationUnit, string]>).reduce(
        (acc, [key, labelKey]) => {
          acc[key] = t(labelKey);
          return acc;
        },
        {} as Record<SubscriptionDurationUnit, string>,
      ),
    [t],
  );
  const statusLabel = useMemo(
    () =>
      (Object.entries(STATUS_LABEL_KEYS) as Array<[UserSubscription['status'], string]>).reduce(
        (acc, [key, labelKey]) => {
          acc[key] = t(labelKey);
          return acc;
        },
        {} as Record<UserSubscription['status'], string>,
      ),
    [t],
  );
  const paymentStatusLabel = useMemo(
    () =>
      (Object.entries(PAYMENT_STATUS_LABEL_KEYS) as Array<
        [UserSubscription['paymentStatus'], string]
      >).reduce(
        (acc, [key, labelKey]) => {
          acc[key] = t(labelKey);
          return acc;
        },
        {} as Record<UserSubscription['paymentStatus'], string>,
      ),
    [t],
  );
  const isClientSearchActive = clientSearchTerm.length > 0;
  const isAssignClientSearchActive = assignClientSearchTerm.length > 0;
  const visibleClients = isClientSearchActive
    ? clients
    : selectedClient
      ? [selectedClient]
      : EMPTY_CLIENTS;
  const visibleAssignClients = isAssignClientSearchActive
    ? assignClients
    : assignSelectedClient
      ? [assignSelectedClient]
      : EMPTY_CLIENTS;

  useEffect(() => {
    const timeout = window.setTimeout(() => setClientSearchTerm(clientSearchDraft.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [clientSearchDraft]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setAssignClientSearchTerm(assignClientSearchDraft.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [assignClientSearchDraft]);

  useEffect(() => {
    if (!plansQuery.error && !clientsQuery.error) return;
    toast({
      title: t('admin.common.error'),
      description: t('admin.subscriptions.toast.loadError'),
      variant: 'destructive',
    });
  }, [clientsQuery.error, plansQuery.error, t, toast]);

  useEffect(() => {
    setSubscriptionsPage(1);
  }, [selectedClientId]);

  const openPlanDialog = (plan?: SubscriptionPlan) => {
    setEditingPlan(plan || null);
    setPlanForm({
      name: plan?.name || '',
      description: plan?.description || '',
      price: plan ? String(plan.price) : '0',
      durationValue: plan ? String(plan.durationValue) : '1',
      durationUnit: plan?.durationUnit || 'months',
      isActive: plan?.isActive ?? true,
      availabilityStartDate: plan?.availabilityStartDate ? plan.availabilityStartDate.slice(0, 10) : '',
      availabilityEndDate: plan?.availabilityEndDate ? plan.availabilityEndDate.slice(0, 10) : '',
      displayOrder: plan ? String(plan.displayOrder) : '0',
    });
    setIsPlanDialogOpen(true);
  };

  const handleSubmitPlan = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = planForm.name.trim();
    const description = planForm.description.trim();
    const price = Number(planForm.price);
    const durationValue = Number(planForm.durationValue);
    const displayOrder = Number(planForm.displayOrder);

    if (!name) {
      toast({
        title: t('admin.subscriptions.toast.requiredNameTitle'),
        description: t('admin.subscriptions.toast.requiredNameDescription'),
        variant: 'destructive',
      });
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast({
        title: t('admin.subscriptions.toast.invalidPriceTitle'),
        description: t('admin.subscriptions.toast.invalidPriceDescription'),
        variant: 'destructive',
      });
      return;
    }
    if (!Number.isFinite(durationValue) || durationValue < 1) {
      toast({
        title: t('admin.subscriptions.toast.invalidDurationTitle'),
        description: t('admin.subscriptions.toast.invalidDurationDescription'),
        variant: 'destructive',
      });
      return;
    }
    if (!Number.isFinite(displayOrder)) {
      toast({
        title: t('admin.subscriptions.toast.invalidOrderTitle'),
        description: t('admin.subscriptions.toast.invalidOrderDescription'),
        variant: 'destructive',
      });
      return;
    }
    if (
      planForm.availabilityStartDate &&
      planForm.availabilityEndDate &&
      planForm.availabilityEndDate < planForm.availabilityStartDate
    ) {
      toast({
        title: t('admin.subscriptions.toast.invalidAvailabilityTitle'),
        description: t('admin.subscriptions.toast.invalidAvailabilityDescription'),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmittingPlan(true);
    try {
      const payload = {
        name,
        description: description || null,
        price,
        durationValue: Math.floor(durationValue),
        durationUnit: planForm.durationUnit,
        isActive: planForm.isActive,
        availabilityStartDate: planForm.availabilityStartDate || null,
        availabilityEndDate: planForm.availabilityEndDate || null,
        displayOrder: Math.floor(displayOrder),
      };
      if (editingPlan) {
        await updateSubscriptionPlan(editingPlan.id, payload);
      } else {
        await createSubscriptionPlan(payload);
      }
      await plansQuery.refetch();
      toast({
        title: editingPlan
          ? t('admin.subscriptions.toast.planUpdatedTitle')
          : t('admin.subscriptions.toast.planCreatedTitle'),
        description: t('admin.subscriptions.toast.savedDescription'),
      });
      setIsPlanDialogOpen(false);
    } catch (error) {
      toast({
        title: t('admin.subscriptions.toast.saveErrorTitle'),
        description: error instanceof Error ? error.message : t('admin.common.tryAgainInSeconds'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  const handleArchivePlan = async () => {
    if (!planToArchive) return;
    try {
      await archiveSubscriptionPlan(planToArchive.id);
      await plansQuery.refetch();
      toast({
        title: t('admin.subscriptions.toast.planArchivedTitle'),
        description: t('admin.subscriptions.toast.planArchivedDescription'),
      });
    } catch (error) {
      toast({
        title: t('admin.subscriptions.toast.archiveErrorTitle'),
        description: error instanceof Error ? error.message : t('admin.common.tryAgainInSeconds'),
        variant: 'destructive',
      });
    } finally {
      setPlanToArchive(null);
    }
  };

  const handleTogglePlanActive = async (plan: SubscriptionPlan, isActive: boolean) => {
    try {
      await updateSubscriptionPlan(plan.id, { isActive });
      await plansQuery.refetch();
    } catch (error) {
      toast({
        title: t('admin.subscriptions.toast.toggleErrorTitle'),
        description: error instanceof Error ? error.message : t('admin.subscriptions.toast.tryAgainLater'),
        variant: 'destructive',
      });
    }
  };

  const openAssignDialog = () => {
    const defaultUserId = selectedClientId !== 'none' ? selectedClientId : 'none';
    const defaultPlanId = activePlans[0]?.id || 'none';
    setAssignForm({
      userId: defaultUserId,
      planId: defaultPlanId,
      startDate: '',
      notes: '',
    });
    setAssignClientSearchDraft('');
    setAssignClientSearchTerm('');
    setAssignClientsPage(1);
    setIsAssignDialogOpen(true);
  };

  const handleAssignPlan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (assignForm.userId === 'none') {
      toast({
        title: t('admin.subscriptions.toast.requiredClientTitle'),
        description: t('admin.subscriptions.toast.requiredClientDescription'),
        variant: 'destructive',
      });
      return;
    }
    if (assignForm.planId === 'none') {
      toast({
        title: t('admin.subscriptions.toast.requiredPlanTitle'),
        description: t('admin.subscriptions.toast.requiredPlanDescription'),
        variant: 'destructive',
      });
      return;
    }

    setIsAssigning(true);
    try {
      await assignUserSubscription(assignForm.userId, {
        planId: assignForm.planId,
        startDate: assignForm.startDate || undefined,
        notes: assignForm.notes.trim() || null,
      });
      await Promise.all([
        plansQuery.refetch(),
        selectedClientId !== 'none' ? selectedClientQuery.refetch() : Promise.resolve(),
        selectedClientId !== 'none' ? userSubscriptionsQuery.refetch() : Promise.resolve(),
        selectedClientId !== 'none' ? userActiveSubscriptionQuery.refetch() : Promise.resolve(),
      ]);
      if (selectedClientId !== assignForm.userId) {
        setSelectedClientId(assignForm.userId);
        setSubscriptionsPage(1);
      }
      toast({
        title: t('admin.subscriptions.toast.assignedTitle'),
        description: t('admin.subscriptions.toast.assignedDescription'),
      });
      setIsAssignDialogOpen(false);
    } catch (error) {
      toast({
        title: t('admin.subscriptions.toast.assignErrorTitle'),
        description: error instanceof Error ? error.message : t('admin.common.tryAgainInSeconds'),
        variant: 'destructive',
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleMarkSubscriptionPaid = async (subscription: UserSubscription) => {
    if (selectedClientId === 'none') return;
    setMarkingPaidSubscriptionId(subscription.id);
    try {
      await markUserSubscriptionPaid(selectedClientId, subscription.id);
      await Promise.all([userSubscriptionsQuery.refetch(), userActiveSubscriptionQuery.refetch()]);
      toast({
        title: t('admin.subscriptions.toast.paymentUpdatedTitle'),
        description: t('admin.subscriptions.toast.paymentUpdatedDescription'),
      });
    } catch (error) {
      toast({
        title: t('admin.subscriptions.toast.updateErrorTitle'),
        description: error instanceof Error ? error.message : t('admin.common.tryAgainInSeconds'),
        variant: 'destructive',
      });
    } finally {
      setMarkingPaidSubscriptionId(null);
    }
  };

  const isLoading = plansQuery.isLoading;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="pl-12 md:pl-0">
          <h1 className="text-3xl font-bold text-foreground">{t('admin.subscriptions.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('admin.subscriptions.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openAssignDialog} disabled={activePlans.length === 0}>
            <UserIcon className="w-4 h-4 mr-2" />
            {t('admin.subscriptions.actions.assignPlan')}
          </Button>
          <Button variant="glow" onClick={() => openPlanDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            {t('admin.subscriptions.actions.newPlan')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title={t('admin.subscriptions.emptyPlans.title')}
          description={t('admin.subscriptions.emptyPlans.description')}
          action={{ label: t('admin.subscriptions.actions.createPlan'), onClick: () => openPlanDialog() }}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {plans.map((plan) => (
              <Card key={plan.id} variant="elevated">
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <CardDescription>
                        {plan.durationValue} {durationUnitLabels[plan.durationUnit]} · {plan.price.toFixed(2)}€
                      </CardDescription>
                    </div>
                    <Switch
                      checked={plan.isActive}
                      onCheckedChange={(checked) => void handleTogglePlanActive(plan, checked)}
                      disabled={plan.isArchived}
                    />
                  </div>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  )}
                  {(plan.availabilityStartDate || plan.availabilityEndDate) && (
                    <p className="text-xs text-muted-foreground">
                      {t('admin.subscriptions.plan.availabilityWindow')}{' '}
                      {plan.availabilityStartDate
                        ? format(parseISO(plan.availabilityStartDate), 'd MMM yyyy', { locale: dateLocale })
                        : t('admin.subscriptions.plan.noStart')}{' '}
                      -{' '}
                      {plan.availabilityEndDate
                        ? format(parseISO(plan.availabilityEndDate), 'd MMM yyyy', { locale: dateLocale })
                        : t('admin.subscriptions.plan.noEnd')}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                      {plan.isActive
                        ? t('admin.subscriptions.plan.active')
                        : t('admin.subscriptions.plan.inactive')}
                    </Badge>
                    {plan.isArchived && (
                      <Badge variant="outline">{t('admin.subscriptions.plan.archived')}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openPlanDialog(plan)} disabled={plan.isArchived}>
                      <Pencil className="w-4 h-4 mr-1" />
                      {t('admin.common.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setPlanToArchive(plan)}
                      disabled={plan.isArchived}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      {t('admin.subscriptions.actions.archive')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="w-5 h-5 text-primary" />
                {t('admin.subscriptions.clients.title')}
              </CardTitle>
              <CardDescription>
                {t('admin.subscriptions.clients.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[320px,1fr] lg:items-start">
                <div className="space-y-3">
                  <Label htmlFor="subscriptions-client-search">
                    {t('admin.subscriptions.clients.searchLabel')}
                  </Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="subscriptions-client-search"
                      value={clientSearchDraft}
                      onChange={(event) => {
                        setClientSearchDraft(event.target.value);
                        setClientsPage(1);
                      }}
                      placeholder={t('admin.subscriptions.clients.searchPlaceholder')}
                      className="pl-10"
                    />
                  </div>
                  <div className="max-h-80 overflow-y-auto rounded-lg border border-border/70">
                    {!isClientSearchActive && selectedClientId === 'none' ? (
                      <p className="p-3 text-sm text-muted-foreground">
                        {t('admin.subscriptions.clients.searchHint')}
                      </p>
                    ) : !isClientSearchActive && selectedClientId !== 'none' && selectedClientQuery.isLoading ? (
                      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('admin.subscriptions.clients.loadingSelected')}
                      </div>
                    ) : clientsQuery.isLoading ? (
                      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('admin.subscriptions.clients.loadingSearch')}
                      </div>
                    ) : visibleClients.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">
                        {t('admin.subscriptions.clients.noResults')}
                      </p>
                    ) : (
                      visibleClients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            setSelectedClientId(client.id);
                            setSubscriptionsPage(1);
                            setClientSearchDraft('');
                            setClientSearchTerm('');
                            setClientsPage(1);
                          }}
                          className={`w-full border-b border-border/60 px-3 py-2 text-left last:border-b-0 ${
                            selectedClientId === client.id ? 'bg-primary/10' : 'hover:bg-muted/40'
                          }`}
                        >
                          <p className="text-sm font-medium text-foreground">{client.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {client.email || t('admin.clients.noEmail')}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                  {isClientSearchActive && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t('admin.common.pagination.pageOf', { page: Math.min(clientsPage, clientsTotalPages), total: clientsTotalPages })}</span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setClientsPage((page) => Math.max(1, page - 1))}
                          disabled={clientsPage <= 1}
                        >
                          {t('admin.common.previous')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setClientsPage((page) => Math.min(clientsTotalPages, page + 1))}
                          disabled={clientsPage >= clientsTotalPages}
                        >
                          {t('admin.common.next')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4 rounded-lg border border-border/70 bg-muted/20 p-3">
                  {selectedClientId === 'none' ? (
                    <p className="text-sm text-muted-foreground">
                      {t('admin.subscriptions.clients.selectHint')}
                    </p>
                  ) : selectedClientQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('admin.subscriptions.clients.loading')}
                    </div>
                  ) : selectedClient ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-foreground">{selectedClient.name}</p>
                          <p className="text-xs text-muted-foreground">{selectedClient.email}</p>
                        </div>
                        {userActiveSubscriptionQuery.isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : activeSubscription ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge>
                              {t('admin.subscriptions.activeBadge', { planName: activeSubscription.plan.name })}
                            </Badge>
                            <Badge variant={paymentStatusVariant[activeSubscription.paymentStatus]}>
                              {paymentStatusLabel[activeSubscription.paymentStatus]}
                            </Badge>
                          </div>
                        ) : (
                          <Badge variant="outline">{t('admin.subscriptions.noActive')}</Badge>
                        )}
                      </div>
                      <div className="rounded-md border border-border/70 bg-background/70">
                        {userSubscriptionsQuery.isLoading ? (
                          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t('admin.subscriptions.history.loading')}
                          </div>
                        ) : selectedClientSubscriptions.length === 0 ? (
                          <p className="p-3 text-sm text-muted-foreground">
                            {t('admin.subscriptions.history.empty')}
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t('admin.subscriptions.table.plan')}</TableHead>
                                <TableHead>{t('admin.subscriptions.table.period')}</TableHead>
                                <TableHead>{t('admin.subscriptions.table.status')}</TableHead>
                                <TableHead>{t('admin.subscriptions.table.payment')}</TableHead>
                                <TableHead>{t('admin.subscriptions.table.source')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedClientSubscriptions.map((subscription) => (
                                <TableRow key={subscription.id}>
                                  <TableCell className="font-medium">{subscription.plan.name}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {format(parseISO(subscription.startDate), 'd MMM yyyy', { locale: dateLocale })} -{' '}
                                    {format(parseISO(subscription.endDate), 'd MMM yyyy', { locale: dateLocale })}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={statusVariant[subscription.status]}>
                                      {statusLabel[subscription.status]}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Badge variant={paymentStatusVariant[subscription.paymentStatus]}>
                                        {paymentStatusLabel[subscription.paymentStatus]}
                                      </Badge>
                                      {subscription.paymentStatus !== 'paid' && subscription.status === 'active' && (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          disabled={markingPaidSubscriptionId === subscription.id}
                                          onClick={() => void handleMarkSubscriptionPaid(subscription)}
                                        >
                                          {markingPaidSubscriptionId === subscription.id && (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          )}
                                          {t('admin.subscriptions.actions.markPaid')}
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {subscription.source === 'admin'
                                      ? t('admin.subscriptions.source.admin')
                                      : t('admin.subscriptions.source.client')}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {subscriptionsTotal === 0
                            ? t('admin.subscriptions.pagination.noRecords')
                            : t('admin.subscriptions.pagination.range', {
                                from: (subscriptionsPage - 1) * SUBSCRIPTIONS_PAGE_SIZE + 1,
                                to: Math.min(subscriptionsPage * SUBSCRIPTIONS_PAGE_SIZE, subscriptionsTotal),
                                total: subscriptionsTotal,
                              })}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setSubscriptionsPage((page) => Math.max(1, page - 1))}
                            disabled={subscriptionsPage <= 1}
                          >
                            {t('admin.common.previous')}
                          </Button>
                          <span>{t('admin.common.pagination.pageOf', { page: Math.min(subscriptionsPage, subscriptionsTotalPages), total: subscriptionsTotalPages })}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setSubscriptionsPage((page) => Math.min(subscriptionsTotalPages, page + 1))}
                            disabled={subscriptionsPage >= subscriptionsTotalPages}
                          >
                            {t('admin.common.next')}
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('admin.subscriptions.clients.loadSelectedError')}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPlan
                ? t('admin.subscriptions.dialog.editPlanTitle')
                : t('admin.subscriptions.dialog.newPlanTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('admin.subscriptions.dialog.planDescription')}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmitPlan}>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="subscription-name">{t('admin.subscriptions.fields.name')}</Label>
                <InlineTranslationPopover
                  entityType="subscription_plan"
                  entityId={editingPlan?.id}
                  fieldKey="name"
                  onUpdated={async () => {
                    await plansQuery.refetch();
                  }}
                />
              </div>
              <Input
                id="subscription-name"
                value={planForm.name}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={t('admin.subscriptions.fields.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="subscription-description">{t('admin.subscriptions.fields.description')}</Label>
                <InlineTranslationPopover
                  entityType="subscription_plan"
                  entityId={editingPlan?.id}
                  fieldKey="description"
                  onUpdated={async () => {
                    await plansQuery.refetch();
                  }}
                />
              </div>
              <Textarea
                id="subscription-description"
                value={planForm.description}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, description: event.target.value }))}
                className="min-h-[90px]"
                placeholder={t('admin.subscriptions.fields.descriptionPlaceholder')}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subscription-price">{t('admin.subscriptions.fields.price')}</Label>
                <Input
                  id="subscription-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={planForm.price}
                  onChange={(event) => setPlanForm((prev) => ({ ...prev, price: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscription-display-order">{t('admin.subscriptions.fields.order')}</Label>
                <Input
                  id="subscription-display-order"
                  type="number"
                  step="1"
                  value={planForm.displayOrder}
                  onChange={(event) => setPlanForm((prev) => ({ ...prev, displayOrder: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subscription-duration-value">{t('admin.subscriptions.fields.duration')}</Label>
                <Input
                  id="subscription-duration-value"
                  type="number"
                  min="1"
                  step="1"
                  value={planForm.durationValue}
                  onChange={(event) => setPlanForm((prev) => ({ ...prev, durationValue: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.subscriptions.fields.durationUnit')}</Label>
                <Select
                  value={planForm.durationUnit}
                  onValueChange={(value) =>
                    setPlanForm((prev) => ({ ...prev, durationUnit: value as SubscriptionDurationUnit }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">{t('admin.subscriptions.durationUnit.daysPlural')}</SelectItem>
                    <SelectItem value="weeks">{t('admin.subscriptions.durationUnit.weeksPlural')}</SelectItem>
                    <SelectItem value="months">{t('admin.subscriptions.durationUnit.monthsPlural')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subscription-availability-start">
                  {t('admin.subscriptions.fields.availabilityStart')}
                </Label>
                <Input
                  id="subscription-availability-start"
                  type="date"
                  value={planForm.availabilityStartDate}
                  onChange={(event) =>
                    setPlanForm((prev) => ({ ...prev, availabilityStartDate: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscription-availability-end">
                  {t('admin.subscriptions.fields.availabilityEnd')}
                </Label>
                <Input
                  id="subscription-availability-end"
                  type="date"
                  value={planForm.availabilityEndDate}
                  onChange={(event) =>
                    setPlanForm((prev) => ({ ...prev, availabilityEndDate: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{t('admin.subscriptions.fields.planActive')}</p>
                <p className="text-xs text-muted-foreground">{t('admin.subscriptions.fields.planActiveHint')}</p>
              </div>
              <Switch
                checked={planForm.isActive}
                onCheckedChange={(checked) => setPlanForm((prev) => ({ ...prev, isActive: checked }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPlanDialogOpen(false)}>
                {t('appointmentEditor.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmittingPlan}>
                {isSubmittingPlan && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {t('admin.subscriptions.actions.savePlan')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('admin.subscriptions.dialog.assignTitle')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('admin.subscriptions.dialog.assignDescription')}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAssignPlan}>
            <div className="space-y-2">
              <Label htmlFor="assign-client-search">{t('admin.common.client')}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="assign-client-search"
                  value={assignClientSearchDraft}
                  onChange={(event) => {
                    setAssignClientSearchDraft(event.target.value);
                    setAssignClientsPage(1);
                  }}
                  placeholder={t('admin.subscriptions.assign.searchPlaceholder')}
                  className="pl-10"
                />
              </div>
              <div className="max-h-52 overflow-y-auto rounded-md border border-border/70">
                {!isAssignClientSearchActive && assignForm.userId === 'none' ? (
                  <p className="p-3 text-sm text-muted-foreground">{t('admin.subscriptions.assign.searchHint')}</p>
                ) : !isAssignClientSearchActive && assignForm.userId !== 'none' && assignSelectedClientQuery.isLoading ? (
                  <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('admin.subscriptions.clients.loadingSelected')}
                  </div>
                ) : assignClientsQuery.isLoading ? (
                  <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('admin.subscriptions.clients.loadingSearch')}
                  </div>
                ) : visibleAssignClients.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">{t('admin.search.empty.title')}</p>
                ) : (
                  visibleAssignClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => {
                        setAssignForm((prev) => ({ ...prev, userId: client.id }));
                        setAssignClientSearchDraft('');
                        setAssignClientSearchTerm('');
                        setAssignClientsPage(1);
                      }}
                      className={`w-full border-b border-border/60 px-3 py-2 text-left last:border-b-0 ${
                        assignForm.userId === client.id ? 'bg-primary/10' : 'hover:bg-muted/40'
                      }`}
                    >
                      <p className="text-sm font-medium text-foreground">{client.name}</p>
                      <p className="text-xs text-muted-foreground">{client.email || t('admin.clients.noEmail')}</p>
                    </button>
                  ))
                )}
              </div>
              {isAssignClientSearchActive && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('admin.common.pagination.pageOf', { page: Math.min(assignClientsPage, assignClientsTotalPages), total: assignClientsTotalPages })}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAssignClientsPage((page) => Math.max(1, page - 1))}
                      disabled={assignClientsPage <= 1}
                    >
                      {t('admin.common.previous')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAssignClientsPage((page) => Math.min(assignClientsTotalPages, page + 1))}
                      disabled={assignClientsPage >= assignClientsTotalPages}
                    >
                      {t('admin.common.next')}
                    </Button>
                  </div>
                </div>
              )}
              {assignSelectedClient && (
                <p className="text-xs text-muted-foreground">
                  {t('admin.subscriptions.assign.selected')}{' '}
                  <span className="font-medium text-foreground">{assignSelectedClient.name}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('admin.subscriptions.fields.plan')}</Label>
              <Select
                value={assignForm.planId}
                onValueChange={(value) => setAssignForm((prev) => ({ ...prev, planId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.subscriptions.fields.selectPlan')} />
                </SelectTrigger>
                <SelectContent>
                  {activePlans.length === 0 && (
                    <SelectItem value="none">{t('admin.subscriptions.assign.noActivePlans')}</SelectItem>
                  )}
                  {activePlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-start-date">{t('admin.subscriptions.fields.startDate')}</Label>
              <Input
                id="assign-start-date"
                type="date"
                value={assignForm.startDate}
                onChange={(event) => setAssignForm((prev) => ({ ...prev, startDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-notes">{t('admin.subscriptions.fields.internalNote')}</Label>
              <Textarea
                id="assign-notes"
                value={assignForm.notes}
                onChange={(event) => setAssignForm((prev) => ({ ...prev, notes: event.target.value }))}
                className="min-h-[90px]"
                placeholder={t('admin.subscriptions.fields.internalNotePlaceholder')}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                {t('appointmentEditor.cancel')}
              </Button>
              <Button type="submit" disabled={isAssigning}>
                {isAssigning && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {t('admin.subscriptions.actions.assign')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(planToArchive)} onOpenChange={(open) => !open && setPlanToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.subscriptions.archiveDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.subscriptions.archiveDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('appointmentEditor.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleArchivePlan}>
              {t('admin.subscriptions.actions.archive')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSubscriptions;
