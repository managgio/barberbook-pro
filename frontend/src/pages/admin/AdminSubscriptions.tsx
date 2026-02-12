import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
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

const EMPTY_PLANS: SubscriptionPlan[] = [];
const EMPTY_CLIENTS: User[] = [];
const EMPTY_SUBSCRIPTIONS: UserSubscription[] = [];
const CLIENTS_PAGE_SIZE = 10;
const SUBSCRIPTIONS_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const durationUnitLabels: Record<SubscriptionDurationUnit, string> = {
  days: 'día(s)',
  weeks: 'semana(s)',
  months: 'mes(es)',
};

const statusVariant: Record<UserSubscription['status'], 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  cancelled: 'outline',
  expired: 'secondary',
};

const statusLabel: Record<UserSubscription['status'], string> = {
  active: 'Activa',
  cancelled: 'Cancelada',
  expired: 'Expirada',
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

const paymentStatusLabel: Record<UserSubscription['paymentStatus'], string> = {
  paid: 'Pagada',
  in_person: 'Pendiente próxima cita',
  pending: 'Pendiente Stripe',
  failed: 'Pago fallido',
  cancelled: 'Pago cancelado',
  exempt: 'Exenta',
};

const AdminSubscriptions: React.FC = () => {
  const { toast } = useToast();
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
    queryFn: () => getUserActiveSubscription(selectedClientId),
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
      title: 'Error',
      description: 'No se pudieron cargar las suscripciones.',
      variant: 'destructive',
    });
  }, [clientsQuery.error, plansQuery.error, toast]);

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
        title: 'Nombre requerido',
        description: 'Indica el nombre del plan.',
        variant: 'destructive',
      });
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast({
        title: 'Precio inválido',
        description: 'Introduce un precio válido (0 o mayor).',
        variant: 'destructive',
      });
      return;
    }
    if (!Number.isFinite(durationValue) || durationValue < 1) {
      toast({
        title: 'Duración inválida',
        description: 'La duración debe ser un número mayor o igual a 1.',
        variant: 'destructive',
      });
      return;
    }
    if (!Number.isFinite(displayOrder)) {
      toast({
        title: 'Orden inválido',
        description: 'El orden debe ser numérico.',
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
        title: 'Disponibilidad inválida',
        description: 'La fecha de fin no puede ser anterior a la fecha de inicio.',
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
        title: editingPlan ? 'Plan actualizado' : 'Plan creado',
        description: 'Los cambios se guardaron correctamente.',
      });
      setIsPlanDialogOpen(false);
    } catch (error) {
      toast({
        title: 'No se pudo guardar',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
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
        title: 'Plan archivado',
        description: 'El plan ya no estará disponible para nuevas altas.',
      });
    } catch (error) {
      toast({
        title: 'No se pudo archivar',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
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
        title: 'No se pudo cambiar el estado',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
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
        title: 'Cliente requerido',
        description: 'Selecciona un cliente para asignar la suscripción.',
        variant: 'destructive',
      });
      return;
    }
    if (assignForm.planId === 'none') {
      toast({
        title: 'Plan requerido',
        description: 'Selecciona el plan que quieres asignar.',
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
        title: 'Suscripción asignada',
        description: 'La suscripción quedó activa para ese cliente.',
      });
      setIsAssignDialogOpen(false);
    } catch (error) {
      toast({
        title: 'No se pudo asignar',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
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
        title: 'Pago actualizado',
        description: 'La suscripción quedó marcada como pagada.',
      });
    } catch (error) {
      toast({
        title: 'No se pudo actualizar',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
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
          <h1 className="text-3xl font-bold text-foreground">Suscripciones</h1>
          <p className="text-muted-foreground mt-1">
            Configura planes por local y asigna suscripciones a clientes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openAssignDialog} disabled={activePlans.length === 0}>
            <UserIcon className="w-4 h-4 mr-2" />
            Asignar plan
          </Button>
          <Button variant="glow" onClick={() => openPlanDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo plan
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
          title="Sin planes de suscripción"
          description="Crea tu primer plan para empezar a gestionar clientes suscritos."
          action={{ label: 'Crear plan', onClick: () => openPlanDialog() }}
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
                      Ventana de alta:{' '}
                      {plan.availabilityStartDate
                        ? format(parseISO(plan.availabilityStartDate), 'd MMM yyyy', { locale: es })
                        : 'sin inicio'}{' '}
                      -{' '}
                      {plan.availabilityEndDate
                        ? format(parseISO(plan.availabilityEndDate), 'd MMM yyyy', { locale: es })
                        : 'sin fin'}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                      {plan.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                    {plan.isArchived && <Badge variant="outline">Archivado</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openPlanDialog(plan)} disabled={plan.isArchived}>
                      <Pencil className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setPlanToArchive(plan)}
                      disabled={plan.isArchived}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Archivar
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
                Suscripciones por cliente
              </CardTitle>
              <CardDescription>
                Consulta qué cliente está suscrito actualmente y su historial de planes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[320px,1fr] lg:items-start">
                <div className="space-y-3">
                  <Label htmlFor="subscriptions-client-search">Buscar cliente</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="subscriptions-client-search"
                      value={clientSearchDraft}
                      onChange={(event) => {
                        setClientSearchDraft(event.target.value);
                        setClientsPage(1);
                      }}
                      placeholder="Nombre, email o teléfono..."
                      className="pl-10"
                    />
                  </div>
                  <div className="max-h-80 overflow-y-auto rounded-lg border border-border/70">
                    {!isClientSearchActive && selectedClientId === 'none' ? (
                      <p className="p-3 text-sm text-muted-foreground">
                        Escribe para buscar un cliente.
                      </p>
                    ) : !isClientSearchActive && selectedClientId !== 'none' && selectedClientQuery.isLoading ? (
                      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando cliente seleccionado...
                      </div>
                    ) : clientsQuery.isLoading ? (
                      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Buscando clientes...
                      </div>
                    ) : visibleClients.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">No se encontraron clientes.</p>
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
                          <p className="text-xs text-muted-foreground">{client.email || 'Sin email'}</p>
                        </button>
                      ))
                    )}
                  </div>
                  {isClientSearchActive && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Página {Math.min(clientsPage, clientsTotalPages)} de {clientsTotalPages}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setClientsPage((page) => Math.max(1, page - 1))}
                          disabled={clientsPage <= 1}
                        >
                          Anterior
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setClientsPage((page) => Math.min(clientsTotalPages, page + 1))}
                          disabled={clientsPage >= clientsTotalPages}
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4 rounded-lg border border-border/70 bg-muted/20 p-3">
                  {selectedClientId === 'none' ? (
                    <p className="text-sm text-muted-foreground">
                      Selecciona un cliente para ver sus suscripciones.
                    </p>
                  ) : selectedClientQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando cliente...
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
                            <Badge>Activa: {activeSubscription.plan.name}</Badge>
                            <Badge variant={paymentStatusVariant[activeSubscription.paymentStatus]}>
                              {paymentStatusLabel[activeSubscription.paymentStatus]}
                            </Badge>
                          </div>
                        ) : (
                          <Badge variant="outline">Sin suscripción activa</Badge>
                        )}
                      </div>
                      <div className="rounded-md border border-border/70 bg-background/70">
                        {userSubscriptionsQuery.isLoading ? (
                          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Cargando historial...
                          </div>
                        ) : selectedClientSubscriptions.length === 0 ? (
                          <p className="p-3 text-sm text-muted-foreground">
                            Este cliente aún no tiene suscripciones registradas.
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Plan</TableHead>
                                <TableHead>Periodo</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Pago</TableHead>
                                <TableHead>Alta</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedClientSubscriptions.map((subscription) => (
                                <TableRow key={subscription.id}>
                                  <TableCell className="font-medium">{subscription.plan.name}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {format(parseISO(subscription.startDate), 'd MMM yyyy', { locale: es })} -{' '}
                                    {format(parseISO(subscription.endDate), 'd MMM yyyy', { locale: es })}
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
                                          Marcar pagada
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {subscription.source === 'admin' ? 'Admin' : 'Cliente'}
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
                            ? 'Sin registros'
                            : `${(subscriptionsPage - 1) * SUBSCRIPTIONS_PAGE_SIZE + 1}-${
                                Math.min(subscriptionsPage * SUBSCRIPTIONS_PAGE_SIZE, subscriptionsTotal)
                              } de ${subscriptionsTotal}`}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setSubscriptionsPage((page) => Math.max(1, page - 1))}
                            disabled={subscriptionsPage <= 1}
                          >
                            Anterior
                          </Button>
                          <span>
                            Página {Math.min(subscriptionsPage, subscriptionsTotalPages)} de {subscriptionsTotalPages}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setSubscriptionsPage((page) => Math.min(subscriptionsTotalPages, page + 1))}
                            disabled={subscriptionsPage >= subscriptionsTotalPages}
                          >
                            Siguiente
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No se pudo cargar el cliente seleccionado.
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
            <DialogTitle>{editingPlan ? 'Editar plan' : 'Nuevo plan'}</DialogTitle>
            <DialogDescription className="sr-only">
              Configura precio, duración y estado del plan de suscripción.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmitPlan}>
            <div className="space-y-2">
              <Label htmlFor="subscription-name">Nombre</Label>
              <Input
                id="subscription-name"
                value={planForm.name}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ej. Plan trimestral ilimitado"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subscription-description">Descripción</Label>
              <Textarea
                id="subscription-description"
                value={planForm.description}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, description: event.target.value }))}
                className="min-h-[90px]"
                placeholder="Describe qué incluye este plan."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subscription-price">Precio (€)</Label>
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
                <Label htmlFor="subscription-display-order">Orden</Label>
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
                <Label htmlFor="subscription-duration-value">Duración</Label>
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
                <Label>Unidad</Label>
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
                    <SelectItem value="days">Días</SelectItem>
                    <SelectItem value="weeks">Semanas</SelectItem>
                    <SelectItem value="months">Meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subscription-availability-start">Alta desde (opcional)</Label>
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
                <Label htmlFor="subscription-availability-end">Alta hasta (opcional)</Label>
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
                <p className="text-sm font-medium text-foreground">Plan activo</p>
                <p className="text-xs text-muted-foreground">Disponible para nuevas altas.</p>
              </div>
              <Switch
                checked={planForm.isActive}
                onCheckedChange={(checked) => setPlanForm((prev) => ({ ...prev, isActive: checked }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPlanDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingPlan}>
                {isSubmittingPlan && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Guardar plan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Asignar suscripción</DialogTitle>
            <DialogDescription className="sr-only">
              Selecciona cliente, plan y fecha de inicio para activar una suscripción.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAssignPlan}>
            <div className="space-y-2">
              <Label htmlFor="assign-client-search">Cliente</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="assign-client-search"
                  value={assignClientSearchDraft}
                  onChange={(event) => {
                    setAssignClientSearchDraft(event.target.value);
                    setAssignClientsPage(1);
                  }}
                  placeholder="Buscar cliente..."
                  className="pl-10"
                />
              </div>
              <div className="max-h-52 overflow-y-auto rounded-md border border-border/70">
                {!isAssignClientSearchActive && assignForm.userId === 'none' ? (
                  <p className="p-3 text-sm text-muted-foreground">Escribe para buscar cliente.</p>
                ) : !isAssignClientSearchActive && assignForm.userId !== 'none' && assignSelectedClientQuery.isLoading ? (
                  <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando cliente seleccionado...
                  </div>
                ) : assignClientsQuery.isLoading ? (
                  <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando clientes...
                  </div>
                ) : visibleAssignClients.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Sin resultados.</p>
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
                      <p className="text-xs text-muted-foreground">{client.email || 'Sin email'}</p>
                    </button>
                  ))
                )}
              </div>
              {isAssignClientSearchActive && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Página {Math.min(assignClientsPage, assignClientsTotalPages)} de {assignClientsTotalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAssignClientsPage((page) => Math.max(1, page - 1))}
                      disabled={assignClientsPage <= 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAssignClientsPage((page) => Math.min(assignClientsTotalPages, page + 1))}
                      disabled={assignClientsPage >= assignClientsTotalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
              {assignSelectedClient && (
                <p className="text-xs text-muted-foreground">
                  Seleccionado: <span className="font-medium text-foreground">{assignSelectedClient.name}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select
                value={assignForm.planId}
                onValueChange={(value) => setAssignForm((prev) => ({ ...prev, planId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona plan" />
                </SelectTrigger>
                <SelectContent>
                  {activePlans.length === 0 && <SelectItem value="none">Sin planes activos</SelectItem>}
                  {activePlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-start-date">Fecha de inicio (opcional)</Label>
              <Input
                id="assign-start-date"
                type="date"
                value={assignForm.startDate}
                onChange={(event) => setAssignForm((prev) => ({ ...prev, startDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-notes">Nota interna (opcional)</Label>
              <Textarea
                id="assign-notes"
                value={assignForm.notes}
                onChange={(event) => setAssignForm((prev) => ({ ...prev, notes: event.target.value }))}
                className="min-h-[90px]"
                placeholder="Ej. Alta manual en mostrador."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isAssigning}>
                {isAssigning && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Asignar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(planToArchive)} onOpenChange={(open) => !open && setPlanToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivar plan</AlertDialogTitle>
            <AlertDialogDescription>
              Este plan no aparecerá para nuevas altas, pero se mantendrá en el historial de clientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleArchivePlan}>
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSubscriptions;
