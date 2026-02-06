import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAdminSearchAppointments, getAdminStripeConfig, updateAppointment } from '@/data/api';
import { AdminSearchAppointmentsResponse, Appointment, Barber, PaymentMethod, Service } from '@/data/types';
import { Search, Loader2, Pencil, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import EmptyState from '@/components/common/EmptyState';
import { ListSkeleton } from '@/components/common/Skeleton';
import AppointmentEditorDialog from '@/components/common/AppointmentEditorDialog';
import AppointmentNoteIndicator from '@/components/common/AppointmentNoteIndicator';
import AppointmentStatusPicker from '@/components/common/AppointmentStatusPicker';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import defaultAvatar from '@/assets/img/default-image.webp';
import { dispatchAppointmentsUpdated } from '@/lib/adminEvents';
import { getAllNounLabel, useBusinessCopy } from '@/lib/businessCopy';
import { fetchBarbersCached, fetchServicesCached } from '@/lib/catalogQuery';
import { useForegroundRefresh } from '@/hooks/useForegroundRefresh';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenant } from '@/context/TenantContext';

const formatPriceInput = (value: number) => value.toFixed(2).replace('.', ',');
const PAGE_SIZE = 25;
const EMPTY_APPOINTMENTS: Appointment[] = [];
const EMPTY_BARBERS: Barber[] = [];
const EMPTY_SERVICES: Service[] = [];

const AdminSearch: React.FC = () => {
  const { toast } = useToast();
  const copy = useBusinessCopy();
  const { currentLocationId } = useTenant();
  const queryClient = useQueryClient();
  const DATE_STORAGE_KEY = 'managgio.adminSearchDate';
  const [selectedBarberId, setSelectedBarberId] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(DATE_STORAGE_KEY) ?? '';
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [paymentMethodDrafts, setPaymentMethodDrafts] = useState<Record<string, PaymentMethod | 'none'>>({});
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [savingPayment, setSavingPayment] = useState<Record<string, boolean>>({});
  const [savingPrice, setSavingPrice] = useState<Record<string, boolean>>({});
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const appointmentsQueryKey = queryKeys.adminSearchAppointments(
    currentLocationId,
    currentPage,
    PAGE_SIZE,
    selectedBarberId === 'all' ? null : selectedBarberId,
    selectedDate || null,
  );
  const appointmentsQuery = useQuery({
    queryKey: appointmentsQueryKey,
    queryFn: () =>
      getAdminSearchAppointments({
        page: currentPage,
        pageSize: PAGE_SIZE,
        barberId: selectedBarberId !== 'all' ? selectedBarberId : undefined,
        date: selectedDate || undefined,
        sort: 'desc',
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
  const stripeConfigQuery = useQuery({
    queryKey: queryKeys.adminStripeConfig(currentLocationId),
    queryFn: getAdminStripeConfig,
  });
  const appointments = appointmentsQuery.data?.items ?? EMPTY_APPOINTMENTS;
  const totalAppointments = appointmentsQuery.data?.total ?? 0;
  const barbers = barbersQuery.data ?? EMPTY_BARBERS;
  const services = servicesQuery.data ?? EMPTY_SERVICES;
  const clients = appointmentsQuery.data?.clients ?? [];
  const stripeEnabled = Boolean(
    stripeConfigQuery.data?.brandEnabled &&
      stripeConfigQuery.data?.platformEnabled &&
      stripeConfigQuery.data?.localEnabled,
  );
  const isLoading =
    appointmentsQuery.isLoading ||
    barbersQuery.isLoading ||
    servicesQuery.isLoading;

  useEffect(() => {
    if (!appointmentsQuery.error) return;
    toast({
      title: 'Error',
      description: 'No se pudieron cargar las citas. Inténtalo de nuevo.',
      variant: 'destructive',
    });
  }, [appointmentsQuery.error, toast]);

  useEffect(() => {
    if (!barbersQuery.error && !servicesQuery.error && !stripeConfigQuery.error) return;
    toast({
      title: 'Error',
      description: 'No se pudieron cargar algunos datos de soporte.',
      variant: 'destructive',
    });
  }, [barbersQuery.error, servicesQuery.error, stripeConfigQuery.error, toast]);

  useEffect(() => {
    const pageData = appointmentsQuery.data;
    if (!pageData) return;
    if (pageData.items.length === 0 && pageData.total > 0 && currentPage > 1) {
      const fallbackPage = Math.max(1, Math.ceil(pageData.total / PAGE_SIZE));
      if (fallbackPage !== currentPage) {
        setCurrentPage(fallbackPage);
      }
    }
  }, [appointmentsQuery.data, currentPage]);

  useForegroundRefresh(() => {
    void Promise.all([
      appointmentsQuery.refetch(),
      barbersQuery.refetch(),
      servicesQuery.refetch(),
      stripeConfigQuery.refetch(),
    ]);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedDate) {
      window.localStorage.setItem(DATE_STORAGE_KEY, selectedDate);
    } else {
      window.localStorage.removeItem(DATE_STORAGE_KEY);
    }
  }, [selectedDate]);

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

  const getBarber = (id: string) => barbers.find(b => b.id === id);
  const getService = (id: string) => services.find(s => s.id === id);
  const getClientInfo = (appointment: Appointment) => {
    const user = clients.find((client) => client.id === appointment.userId);
    return {
      name: user?.name || appointment.guestName || 'Cliente sin cuenta',
      contact: user?.email || user?.phone || appointment.guestContact || 'Sin datos de contacto',
      isGuest: !user,
    };
  };

  const clearFilters = () => {
    setSelectedBarberId('all');
    setSelectedDate('');
    setCurrentPage(1);
  };

  const applyAppointmentUpdate = useCallback((updated: Appointment) => {
    queryClient.setQueryData<AdminSearchAppointmentsResponse>(appointmentsQueryKey, (previous) => {
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
    dispatchAppointmentsUpdated({ source: 'admin-search' });
  }, [appointmentsQueryKey, queryClient]);

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

  const totalPages = Math.max(1, Math.ceil(totalAppointments / PAGE_SIZE));
  const firstResultIndex = totalAppointments === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastResultIndex = Math.min(totalAppointments, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="pl-12 md:pl-0">
        <h1 className="text-3xl font-bold text-foreground">Buscar citas</h1>
        <p className="text-muted-foreground mt-1">
          Busca citas por {copy.staff.singularLower} y fecha.
        </p>
      </div>

      {/* Filters */}
      <Card variant="elevated">
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{copy.staff.singular}</Label>
              <Select
                value={selectedBarberId}
                onValueChange={(value) => {
                  setSelectedBarberId(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Seleccionar ${copy.staff.singularLower}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{getAllNounLabel(copy.staff)}</SelectItem>
                  {barbers.map(barber => (
                    <SelectItem key={barber.id} value={barber.id}>{barber.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Limpiar filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Resultados ({totalAppointments})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ListSkeleton count={5} />
          ) : appointments.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Fecha</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Hora</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Servicio</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      {copy.staff.singular}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Estado</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Método</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Precio final</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((apt) => {
                    const clientInfo = getClientInfo(apt);
                    return (
                      <tr key={apt.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-medium text-foreground">
                          {format(parseISO(apt.startDateTime), 'd MMM yyyy', { locale: es })}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-foreground">
                        {format(parseISO(apt.startDateTime), 'HH:mm')}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-foreground flex items-center gap-2">
                          {clientInfo.name}
                          {clientInfo.isGuest && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                              Invitado
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">{clientInfo.contact}</p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-foreground">
                          <span>{getService(apt.serviceId)?.name}</span>
                          <AppointmentNoteIndicator note={apt.notes} variant="icon" />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <img 
                            src={getBarber(apt.barberId)?.photo || defaultAvatar} 
                            alt=""
                            loading="lazy"
                            decoding="async"
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <span className="text-foreground">{getBarber(apt.barberId)?.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <AppointmentStatusPicker
                          appointment={apt}
                          serviceDurationMinutes={getService(apt.serviceId)?.duration ?? 30}
                          onStatusUpdated={applyAppointmentUpdate}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
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
                          {savingPayment[apt.id] && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end">
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
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
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
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Mostrando {firstResultIndex}-{lastResultIndex} de {totalAppointments}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((previousPage) => Math.max(1, previousPage - 1))}
                    disabled={currentPage <= 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((previousPage) => Math.min(totalPages, previousPage + 1))
                    }
                    disabled={currentPage >= totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Search}
              title="Sin resultados"
              description="No se encontraron citas con los filtros seleccionados."
            />
          )}
        </CardContent>
      </Card>

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
                  dispatchAppointmentsUpdated({ source: 'admin-search' });
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

export default AdminSearch;
