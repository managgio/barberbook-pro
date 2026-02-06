import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  createClientNote,
  deleteClientNote,
  getAdminStripeConfig,
  getAppointmentsPage,
  getClientNotes,
  getUsersPage,
  updateAppointment,
  updateUserBlockStatus,
} from '@/data/api';
import { Appointment, Barber, ClientNote, PaginatedResponse, PaymentMethod, Service, User } from '@/data/types';
import { Search, User as UserIcon, Mail, Phone, Calendar, Pencil, Trash2, HelpCircle, FileText, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { format, parseISO, subMonths, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import EmptyState from '@/components/common/EmptyState';
import { ListSkeleton } from '@/components/common/Skeleton';
import AppointmentEditorDialog from '@/components/common/AppointmentEditorDialog';
import AppointmentNoteIndicator from '@/components/common/AppointmentNoteIndicator';
import AppointmentStatusPicker from '@/components/common/AppointmentStatusPicker';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { dispatchAppointmentsUpdated, dispatchUsersUpdated } from '@/lib/adminEvents';
import { fetchBarbersCached, fetchServicesCached } from '@/lib/catalogQuery';
import { useForegroundRefresh } from '@/hooks/useForegroundRefresh';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenant } from '@/context/TenantContext';

const formatPriceInput = (value: number) => value.toFixed(2).replace('.', ',');
const CLIENTS_PAGE_SIZE = 25;
const APPOINTMENTS_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 250;
const EMPTY_APPOINTMENTS: Appointment[] = [];
const EMPTY_BARBERS: Barber[] = [];
const EMPTY_SERVICES: Service[] = [];
const EMPTY_CLIENTS: User[] = [];
const EMPTY_NOTES: ClientNote[] = [];

const AdminClients: React.FC = () => {
  const { toast } = useToast();
  const { currentLocationId } = useTenant();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [clientsPage, setClientsPage] = useState(1);
  const [appointmentsPage, setAppointmentsPage] = useState(1);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [paymentMethodDrafts, setPaymentMethodDrafts] = useState<Record<string, PaymentMethod | 'none'>>({});
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [savingPayment, setSavingPayment] = useState<Record<string, boolean>>({});
  const [savingPrice, setSavingPrice] = useState<Record<string, boolean>>({});
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const clientsQueryKey = queryKeys.adminClients(
    currentLocationId,
    clientsPage,
    CLIENTS_PAGE_SIZE,
    debouncedSearchTerm,
  );
  const appointmentsQueryKey = queryKeys.adminClientAppointments(
    currentLocationId,
    selectedClientId,
    appointmentsPage,
    APPOINTMENTS_PAGE_SIZE,
  );
  const clientNotesQueryKey = queryKeys.adminClientNotes(currentLocationId, selectedClientId);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const clientsQuery = useQuery({
    queryKey: clientsQueryKey,
    queryFn: () =>
      getUsersPage({
        page: clientsPage,
        pageSize: CLIENTS_PAGE_SIZE,
        role: 'client',
        q: debouncedSearchTerm || undefined,
      }),
  });
  const barbersQuery = useQuery({
    queryKey: queryKeys.barbers(currentLocationId),
    queryFn: () => fetchBarbersCached({ localId: currentLocationId }),
  });
  const servicesQuery = useQuery({
    queryKey: queryKeys.services(currentLocationId, true),
    queryFn: () => fetchServicesCached({ includeArchived: true, localId: currentLocationId }),
  });
  const appointmentsQuery = useQuery({
    queryKey: appointmentsQueryKey,
    queryFn: () =>
      getAppointmentsPage({
        userId: selectedClientId || undefined,
        page: appointmentsPage,
        pageSize: APPOINTMENTS_PAGE_SIZE,
        sort: 'desc',
      }),
    enabled: Boolean(selectedClientId),
  });
  const notesQuery = useQuery({
    queryKey: clientNotesQueryKey,
    queryFn: () => getClientNotes(selectedClientId as string),
    enabled: Boolean(selectedClientId),
  });
  const stripeConfigQuery = useQuery({
    queryKey: queryKeys.adminStripeConfig(currentLocationId),
    queryFn: getAdminStripeConfig,
  });

  const barbers = barbersQuery.data ?? EMPTY_BARBERS;
  const services = servicesQuery.data ?? EMPTY_SERVICES;
  const clients = clientsQuery.data?.items ?? EMPTY_CLIENTS;
  const clientsTotal = clientsQuery.data?.total ?? 0;
  const appointments = appointmentsQuery.data?.items ?? EMPTY_APPOINTMENTS;
  const appointmentsTotal = appointmentsQuery.data?.total ?? 0;
  const clientNotes = notesQuery.data ?? EMPTY_NOTES;
  const stripeEnabled = Boolean(
    stripeConfigQuery.data?.brandEnabled &&
      stripeConfigQuery.data?.platformEnabled &&
      stripeConfigQuery.data?.localEnabled,
  );
  const isLoading = clientsQuery.isLoading || barbersQuery.isLoading || servicesQuery.isLoading;
  const isAppointmentsLoading = Boolean(selectedClientId) && appointmentsQuery.isLoading;
  const isNotesLoading = Boolean(selectedClientId) && notesQuery.isLoading;

  useEffect(() => {
    if (!clientsQuery.error) return;
    toast({
      title: 'No se pudieron cargar los clientes',
      description: 'Inténtalo de nuevo en unos segundos.',
      variant: 'destructive',
    });
  }, [clientsQuery.error, toast]);

  useEffect(() => {
    if (!appointmentsQuery.error) return;
    toast({
      title: 'No se pudieron cargar las citas',
      description: 'Inténtalo de nuevo en unos segundos.',
      variant: 'destructive',
    });
  }, [appointmentsQuery.error, toast]);

  useEffect(() => {
    if (!notesQuery.error) return;
    toast({
      title: 'No se pudieron cargar las notas',
      description: 'Inténtalo de nuevo en unos segundos.',
      variant: 'destructive',
    });
  }, [notesQuery.error, toast]);

  useEffect(() => {
    if (!barbersQuery.error && !servicesQuery.error && !stripeConfigQuery.error) return;
    toast({
      title: 'Error',
      description: 'No se pudieron cargar algunos datos de soporte.',
      variant: 'destructive',
    });
  }, [barbersQuery.error, servicesQuery.error, stripeConfigQuery.error, toast]);

  useEffect(() => {
    const pageData = clientsQuery.data;
    if (!pageData) return;
    if (pageData.items.length === 0 && pageData.total > 0 && clientsPage > 1) {
      const fallbackPage = Math.max(1, Math.ceil(pageData.total / CLIENTS_PAGE_SIZE));
      if (fallbackPage !== clientsPage) {
        setClientsPage(fallbackPage);
      }
    }
  }, [clientsPage, clientsQuery.data]);

  useEffect(() => {
    const pageData = appointmentsQuery.data;
    if (!pageData) return;
    if (pageData.items.length === 0 && pageData.total > 0 && appointmentsPage > 1) {
      const fallbackPage = Math.max(1, Math.ceil(pageData.total / APPOINTMENTS_PAGE_SIZE));
      if (fallbackPage !== appointmentsPage) {
        setAppointmentsPage(fallbackPage);
      }
    }
  }, [appointmentsPage, appointmentsQuery.data]);

  useForegroundRefresh(() => {
    void Promise.all([
      clientsQuery.refetch(),
      barbersQuery.refetch(),
      servicesQuery.refetch(),
      stripeConfigQuery.refetch(),
      selectedClientId ? appointmentsQuery.refetch() : Promise.resolve(),
      selectedClientId ? notesQuery.refetch() : Promise.resolve(),
    ]);
  });

  useEffect(() => {
    if (clients.length === 0) {
      setSelectedClientId(null);
      return;
    }
    if (!selectedClientId || !clients.some((client) => client.id === selectedClientId)) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  useEffect(() => {
    setAppointmentsPage(1);
  }, [selectedClientId]);

  useEffect(() => {
    setNoteDraft('');
    setIsNotesOpen(false);
  }, [selectedClientId]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) || null,
    [clients, selectedClientId]
  );
  const isClientBlocked = selectedClient?.isBlocked ?? false;

  const selectedClientAppointments = appointments;
  const recentNoShows = useMemo(() => {
    if (!selectedClient) return 0;
    const twoMonthsAgo = subMonths(new Date(), 2);
    return selectedClientAppointments.filter((apt) => {
      if (apt.status !== 'no_show') return false;
      const start = parseISO(apt.startDateTime);
      return isAfter(start, twoMonthsAgo);
    }).length;
  }, [selectedClient, selectedClientAppointments]);

  const whatsappNumber = selectedClient?.phone ? selectedClient.phone.replace(/\D/g, '') : '';
  const whatsappLink = whatsappNumber ? `https://wa.me/${whatsappNumber}` : '';

  const getBarber = (id: string) => barbers.find(b => b.id === id);
  const getService = (id: string) => services.find(s => s.id === id);

  const applyAppointmentUpdate = useCallback((updated: Appointment) => {
    queryClient.setQueryData<PaginatedResponse<Appointment>>(appointmentsQueryKey, (previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        items: previous.items.map((appointment) =>
          appointment.id === updated.id ? updated : appointment,
        ),
      };
    });
    setPaymentMethodDrafts((prev) => ({
      ...prev,
      [updated.id]: updated.paymentMethod ?? 'none',
    }));
    setPriceDrafts((prev) => ({
      ...prev,
      [updated.id]: formatPriceInput(updated.price ?? 0),
    }));
    dispatchAppointmentsUpdated({ source: 'admin-clients' });
  }, [appointmentsQueryKey, queryClient]);

  useEffect(() => {
    if (appointments.length === 0) return;
    setPaymentMethodDrafts((prev) => {
      const next = { ...prev };
      let changed = false;
      appointments.forEach((apt) => {
        if (savingPayment[apt.id]) return;
        const nextValue = apt.paymentMethod ?? 'none';
        if (next[apt.id] !== nextValue) {
          next[apt.id] = nextValue;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setPriceDrafts((prev) => {
      const next = { ...prev };
      let changed = false;
      appointments.forEach((apt) => {
        if (editingPriceId === apt.id || savingPrice[apt.id]) return;
        const nextValue = formatPriceInput(apt.price ?? 0);
        if (next[apt.id] !== nextValue) {
          next[apt.id] = nextValue;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [appointments, editingPriceId, savingPayment, savingPrice]);

  const handlePaymentMethodChange = async (appointment: Appointment, value: string) => {
    if (savingPayment[appointment.id]) return;
    setPaymentMethodDrafts((prev) => ({
      ...prev,
      [appointment.id]: value as PaymentMethod | 'none',
    }));
    setSavingPayment((prev) => ({ ...prev, [appointment.id]: true }));
    try {
      const updated = await updateAppointment(appointment.id, {
        paymentMethod: value === 'none' ? null : (value as PaymentMethod),
      });
      applyAppointmentUpdate(updated);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el método de pago.',
        variant: 'destructive',
      });
      setPaymentMethodDrafts((prev) => ({
        ...prev,
        [appointment.id]: appointment.paymentMethod ?? 'none',
      }));
    } finally {
      setSavingPayment((prev) => ({ ...prev, [appointment.id]: false }));
    }
  };

  const commitPrice = async (appointment: Appointment) => {
    if (savingPrice[appointment.id]) return;
    const currentPrice = appointment.price ?? 0;
    const rawValue = (priceDrafts[appointment.id] ?? formatPriceInput(currentPrice)).trim();
    const normalized = rawValue.replace(',', '.');
    if (!normalized) {
      setPriceDrafts((prev) => ({ ...prev, [appointment.id]: formatPriceInput(currentPrice) }));
      return;
    }
    const parsed = Number(normalized);
    if (Number.isNaN(parsed) || parsed < 0) {
      toast({
        title: 'Precio inválido',
        description: 'Introduce un importe válido para la cita.',
        variant: 'destructive',
      });
      setPriceDrafts((prev) => ({ ...prev, [appointment.id]: formatPriceInput(currentPrice) }));
      return;
    }
    if (Math.abs(parsed - currentPrice) < 0.009) {
      setPriceDrafts((prev) => ({ ...prev, [appointment.id]: formatPriceInput(currentPrice) }));
      return;
    }
    setSavingPrice((prev) => ({ ...prev, [appointment.id]: true }));
    try {
      const updated = await updateAppointment(appointment.id, { price: parsed });
      applyAppointmentUpdate(updated);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el precio final.',
        variant: 'destructive',
      });
      setPriceDrafts((prev) => ({ ...prev, [appointment.id]: formatPriceInput(currentPrice) }));
    } finally {
      setSavingPrice((prev) => ({ ...prev, [appointment.id]: false }));
    }
  };

  useEffect(() => {
    if (!isNotesOpen || !selectedClient) return;
    void notesQuery.refetch();
  }, [isNotesOpen, notesQuery, selectedClient]);

  const handleCreateNote = async () => {
    if (!selectedClient || isSavingNote) return;
    const trimmed = noteDraft.trim();
    if (!trimmed) {
      toast({
        title: 'Escribe una nota',
        description: 'La nota no puede estar vacía.',
        variant: 'destructive',
      });
      return;
    }
    if (trimmed.length > 150) {
      toast({
        title: 'Límite superado',
        description: 'La nota no puede superar 150 caracteres.',
        variant: 'destructive',
      });
      return;
    }
    if (clientNotes.length >= 5) {
      toast({
        title: 'Límite alcanzado',
        description: 'Solo puedes guardar hasta 5 notas por cliente.',
        variant: 'destructive',
      });
      return;
    }
    setIsSavingNote(true);
    try {
      const created = await createClientNote({ userId: selectedClient.id, content: trimmed });
      queryClient.setQueryData<ClientNote[]>(clientNotesQueryKey, (previous) => [created, ...(previous ?? EMPTY_NOTES)]);
      setNoteDraft('');
      toast({
        title: 'Nota guardada',
        description: 'La nota interna se añadió correctamente.',
      });
    } catch (error) {
      toast({
        title: 'No se pudo guardar',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (deletingNoteId) return;
    setDeletingNoteId(noteId);
    try {
      await deleteClientNote(noteId);
      queryClient.setQueryData<ClientNote[]>(clientNotesQueryKey, (previous) =>
        (previous ?? EMPTY_NOTES).filter((note) => note.id !== noteId),
      );
      toast({
        title: 'Nota eliminada',
        description: 'La nota interna se eliminó.',
      });
    } catch (error) {
      toast({
        title: 'No se pudo eliminar',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setDeletingNoteId(null);
    }
  };

  const handleToggleBlock = async () => {
    if (!selectedClient || isBlocking) return;
    setIsBlocking(true);
    try {
      const updated = await updateUserBlockStatus(selectedClient.id, !isClientBlocked);
      queryClient.setQueryData<PaginatedResponse<User>>(clientsQueryKey, (previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          items: previous.items.map((client) => (client.id === updated.id ? updated : client)),
        };
      });
      dispatchUsersUpdated({ source: 'admin-clients' });
      toast({
        title: updated.isBlocked ? 'Cliente bloqueado' : 'Cliente desbloqueado',
        description: updated.isBlocked
          ? 'El cliente no podrá acceder a la app de la marca.'
          : 'El cliente vuelve a tener acceso a la app.',
      });
    } catch (error) {
      toast({
        title: 'No se pudo actualizar el bloqueo',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setIsBlocking(false);
      setIsBlockDialogOpen(false);
    }
  };

  const clientsTotalPages = Math.max(1, Math.ceil(clientsTotal / CLIENTS_PAGE_SIZE));
  const appointmentsTotalPages = Math.max(1, Math.ceil(appointmentsTotal / APPOINTMENTS_PAGE_SIZE));
  const appointmentsFirstIndex = appointmentsTotal === 0 ? 0 : (appointmentsPage - 1) * APPOINTMENTS_PAGE_SIZE + 1;
  const appointmentsLastIndex = Math.min(appointmentsTotal, appointmentsPage * APPOINTMENTS_PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="pl-12 md:pl-0">
        <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
        <p className="text-muted-foreground mt-1">
          Busca clientes y consulta su historial de citas.
        </p>
      </div>

      <div className="mt-4 grid lg:grid-cols-3 gap-6">
        {/* Client List */}
        <Card
          variant="elevated"
          className="lg:col-span-1 h-auto max-h-[28vh] sm:max-h-[32vh] lg:h-[calc(100vh-150px)] lg:max-h-none flex flex-col"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-primary" />
              Lista de clientes
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-hidden pt-2">
            <div className="flex h-full flex-col">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, email o teléfono..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setClientsPage(1);
                  }}
                  className="pl-10"
                />
              </div>

              {isLoading ? (
                <div className="flex-1 overflow-y-auto pr-1">
                  <ListSkeleton count={5} />
                </div>
              ) : clients.length > 0 ? (
                <>
                  <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => setSelectedClientId(client.id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedClient?.id === client.id
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-secondary'
                      }`}
                    >
                      <p className="font-medium text-foreground">{client.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {client.email || 'Sin email'}
                      </p>
                      {client.phone && (
                        <p className="text-sm text-muted-foreground">
                          {client.phone}
                        </p>
                      )}
                    </button>
                  ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Página {clientsPage} de {clientsTotalPages}</span>
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
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  No se encontraron clientes
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Client Details */}
        <Card variant="elevated" className="lg:col-span-2 h-[calc(100vh-150px)] flex flex-col">
          <CardHeader>
            <CardTitle>Historial del cliente</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-hidden">
            {selectedClient ? (
              <div className="flex h-full flex-col gap-6">
                {/* Client Info */}
                <div className="p-4 bg-secondary/50 rounded-lg space-y-3 relative">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <UserIcon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-lg text-foreground">{selectedClient.name}</p>
                          {isClientBlocked && (
                            <span className="rounded-full bg-destructive/10 text-destructive text-xs font-semibold px-2 py-0.5">
                              Bloqueado
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">Cliente registrado</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {recentNoShows > 0 && (
                        <div className="rounded-full bg-destructive/10 text-destructive text-xs font-semibold px-2 py-1 inline-flex items-center gap-1">
                          {recentNoShows} inasistencia{recentNoShows > 1 ? 's' : ''}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                aria-label="Info sobre el rango de datos"
                              >
                                <HelpCircle className="w-3.5 h-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-xs">
                              Cálculo basado en las citas visibles en esta página.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                      <Dialog open={isNotesOpen} onOpenChange={setIsNotesOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <FileText className="w-4 h-4" />
                            Notas internas: {isNotesLoading ? '...' : clientNotes.length}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg h-[560px] max-h-[80vh] overflow-hidden flex flex-col">
                          <DialogHeader>
                            <DialogTitle>Notas internas del cliente</DialogTitle>
                            <DialogDescription>
                              Son recordatorios privados para el equipo admin. El cliente no las ve ni recibe.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="flex min-h-0 flex-1 flex-col gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label htmlFor="client-note">Nueva nota</Label>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {noteDraft.length}/150
                                </span>
                              </div>
                              <Textarea
                                id="client-note"
                                placeholder="Ej: Prefiere citas por la tarde, evitar navaja en barba..."
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                maxLength={150}
                                className="min-h-[96px]"
                              />
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{clientNotes.length}/5 notas guardadas</span>
                                <Button
                                  size="sm"
                                  onClick={handleCreateNote}
                                  disabled={isSavingNote || noteDraft.trim().length === 0 || clientNotes.length >= 5}
                                >
                                  {isSavingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar nota'}
                                </Button>
                              </div>
                            </div>
                            <div className="flex min-h-0 flex-1 flex-col space-y-2">
                              <p className="text-sm font-medium text-foreground">Notas guardadas</p>
                              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                                {isNotesLoading ? (
                                  <ListSkeleton count={2} />
                                ) : clientNotes.length > 0 ? (
                                  <div className="space-y-2">
                                    {clientNotes.map((note) => (
                                      <div
                                        key={note.id}
                                        className="rounded-lg border border-border/60 bg-background/60 px-3 py-2"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => handleDeleteNote(note.id)}
                                            disabled={deletingNoteId === note.id}
                                          >
                                            {deletingNoteId === note.id ? (
                                              <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                              <Trash2 className="w-4 h-4" />
                                            )}
                                          </Button>
                                        </div>
                                        <p className="mt-2 text-xs text-muted-foreground">
                                          {format(parseISO(note.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    Aún no hay notas internas para este cliente.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="grid sm:grid-cols-2 gap-3 flex-1">
                      {selectedClient.email ? (
                        <a
                          href={`mailto:${selectedClient.email}`}
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Mail className="w-4 h-4" />
                          {selectedClient.email}
                        </a>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          Sin email
                        </div>
                      )}
                      {whatsappLink ? (
                        <a
                          href={whatsappLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          {selectedClient.phone}
                        </a>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="w-4 h-4" />
                          Sin teléfono
                        </div>
                      )}
                    </div>
                    <div className="flex justify-start sm:justify-end">
                      <AlertDialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant={isClientBlocked ? 'outline' : 'destructive'}
                            size="sm"
                            className={isClientBlocked ? 'border-primary/40 text-primary hover:border-primary/70' : ''}
                          >
                            {isClientBlocked ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            {isClientBlocked ? 'Desbloquear' : 'Bloquear'}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {isClientBlocked ? 'Desbloquear cliente' : 'Bloquear cliente'}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {isClientBlocked
                                ? 'El cliente podrá volver a iniciar sesión en la app de la marca.'
                                : 'Este bloqueo es a nivel de marca y aplica en todos los locales. El cliente no podrá iniciar sesión.'}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isBlocking}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className={
                                isClientBlocked
                                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                              }
                              onClick={handleToggleBlock}
                              disabled={isBlocking}
                            >
                              {isBlocking ? 'Guardando...' : isClientBlocked ? 'Desbloquear' : 'Bloquear'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>

                {/* Appointments */}
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <div className="sticky top-0 z-10 bg-card border-b border-border/60 pb-2">
                      <h4 className="font-medium text-foreground flex items-center gap-2 pt-1">
                        <Calendar className="w-4 h-4 text-primary" />
                        Historial de citas ({appointmentsTotal})
                      </h4>
                    </div>
                    {isAppointmentsLoading ? (
                      <div className="pt-3">
                        <ListSkeleton count={4} />
                      </div>
                    ) : selectedClientAppointments.length > 0 ? (
                      <div className="space-y-2 pt-3">
                        {selectedClientAppointments.map((apt) => (
                          <div 
                            key={apt.id}
                            className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-foreground">{getService(apt.serviceId)?.name}</p>
                                <AppointmentNoteIndicator note={apt.notes} variant="icon" />
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {format(parseISO(apt.startDateTime), "d MMM yyyy, HH:mm", { locale: es })} · {getBarber(apt.barberId)?.name}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <AppointmentStatusPicker
                                appointment={apt}
                                serviceDurationMinutes={getService(apt.serviceId)?.duration ?? 30}
                                onStatusUpdated={applyAppointmentUpdate}
                              />
                              <Select
                                value={paymentMethodDrafts[apt.id] ?? (apt.paymentMethod ?? 'none')}
                                onValueChange={(value) => handlePaymentMethodChange(apt, value)}
                                disabled={Boolean(savingPayment[apt.id])}
                              >
                                <SelectTrigger className="h-8 w-[120px] rounded-full bg-background/70 px-3 text-xs">
                                  <SelectValue placeholder="Método de pago" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cash">Efectivo</SelectItem>
                                  <SelectItem value="card">Tarjeta</SelectItem>
                                  <SelectItem value="bizum">Bizum</SelectItem>
                                  {stripeEnabled && <SelectItem value="stripe">Stripe</SelectItem>}
                                  {!stripeEnabled && (paymentMethodDrafts[apt.id] ?? apt.paymentMethod) === 'stripe' && (
                                    <SelectItem value="stripe" disabled>
                                      Stripe
                                    </SelectItem>
                                  )}
                                  <SelectItem value="none">Sin método</SelectItem>
                                </SelectContent>
                              </Select>
                              {savingPayment[apt.id] && (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              )}
                              <div className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-1.5">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={priceDrafts[apt.id] ?? formatPriceInput(apt.price ?? 0)}
                                  onFocus={(event) => {
                                    setEditingPriceId(apt.id);
                                    event.currentTarget.select();
                                  }}
                                  onBlur={() => {
                                    setEditingPriceId(null);
                                    void commitPrice(apt);
                                  }}
                                  onChange={(event) =>
                                    setPriceDrafts((prev) => ({ ...prev, [apt.id]: event.target.value }))
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.currentTarget.blur();
                                    }
                                    if (event.key === 'Escape') {
                                      setPriceDrafts((prev) => ({
                                        ...prev,
                                        [apt.id]: formatPriceInput(apt.price ?? 0),
                                      }));
                                      event.currentTarget.blur();
                                    }
                                  }}
                                  className="w-[60px] bg-transparent text-center text-base font-semibold text-primary outline-none"
                                  aria-label="Precio final"
                                  disabled={Boolean(savingPrice[apt.id])}
                                />
                                <span className="text-xs font-semibold text-primary">€</span>
                                {savingPrice[apt.id] && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditingAppointment(apt);
                                  setIsEditorOpen(true);
                                }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => setDeleteTarget(apt)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-muted-foreground">
                            Mostrando {appointmentsFirstIndex}-{appointmentsLastIndex} de {appointmentsTotal}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setAppointmentsPage((page) => Math.max(1, page - 1))}
                              disabled={appointmentsPage <= 1}
                            >
                              Anterior
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              Página {appointmentsPage} de {appointmentsTotalPages}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setAppointmentsPage((page) => Math.min(appointmentsTotalPages, page + 1))
                              }
                              disabled={appointmentsPage >= appointmentsTotalPages}
                            >
                              Siguiente
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-6 text-muted-foreground">
                        Este cliente no tiene citas registradas
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={UserIcon}
                title="Selecciona un cliente"
                description="Haz clic en un cliente de la lista para ver su historial."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <AppointmentEditorDialog
        open={isEditorOpen}
        appointment={editingAppointment}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingAppointment(null);
        }}
        onSaved={async () => {
          await appointmentsQuery.refetch();
          setIsEditorOpen(false);
          setEditingAppointment(null);
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar cita?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La cita quedará marcada como cancelada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                setIsDeleting(true);
                try {
                  await updateAppointment(deleteTarget.id, { status: 'cancelled' });
                  toast({ title: 'Cita cancelada', description: 'La cita ha sido cancelada.' });
                  setDeleteTarget(null);
                  dispatchAppointmentsUpdated({ source: 'admin-clients' });
                  await appointmentsQuery.refetch();
                } catch (error) {
                  toast({ title: 'Error', description: 'No se pudo cancelar la cita.', variant: 'destructive' });
                } finally {
                  setIsDeleting(false);
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting ? 'Cancelando...' : 'Cancelar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminClients;
