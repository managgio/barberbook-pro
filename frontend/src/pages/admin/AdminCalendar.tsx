import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { getAdminCalendarData, updateAppointment } from '@/data/api/appointments';
import { getAdminStripeConfig } from '@/data/api/payments';
import { AdminCalendarResponse, Appointment, Barber, PaymentMethod, Service } from '@/data/types';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  Loader2,
  RefreshCcw,
  User as UserIcon,
  Scissors,
  MessageSquare,
  Package,
} from 'lucide-react';
import { 
  format, 
  startOfWeek, 
  addDays, 
  addWeeks, 
  subWeeks,
  addMinutes,
  differenceInMinutes,
  parseISO,
  isSameDay,
  startOfDay,
  setHours,
  setMinutes,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import AppointmentEditorDialog from '@/components/common/AppointmentEditorDialog';
import AppointmentNoteIndicator from '@/components/common/AppointmentNoteIndicator';
import AppointmentStatusPicker from '@/components/common/AppointmentStatusPicker';
import { useToast } from '@/hooks/use-toast';
import defaultAvatar from '@/assets/img/default-image.webp';
import { dispatchAppointmentsUpdated } from '@/lib/adminEvents';
import { getAllNounLabel, useBusinessCopy } from '@/lib/businessCopy';
import { fetchBarbersCached, fetchServicesCached } from '@/lib/catalogQuery';
import { useForegroundRefresh } from '@/hooks/useForegroundRefresh';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenant } from '@/context/TenantContext';
import { resolveBarberAccentColor } from '@/lib/barberColors';

const START_HOUR = 9;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);
const HOUR_HEIGHT = 60;
const MINUTES_IN_DAY_VIEW = HOURS.length * 60;
const BARBER_FILTER_STORAGE_PREFIX = 'admin:calendar:barber-filter';
const NOW_INDICATOR_STORAGE_PREFIX = 'admin:calendar:now-indicator';
const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});
const formatPriceInput = (value: number) => value.toFixed(2).replace('.', ',');
const EMPTY_APPOINTMENTS: Appointment[] = [];
const EMPTY_BARBERS: Barber[] = [];
const EMPTY_SERVICES: Service[] = [];
const EMPTY_CLIENTS: AdminCalendarResponse['clients'] = [];
const EMPTY_CALENDAR_RESPONSE: AdminCalendarResponse = {
  items: EMPTY_APPOINTMENTS,
  clients: EMPTY_CLIENTS,
};
const readCalendarPreference = (key: string) => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeCalendarPreference = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage errors
  }
};
const resolveCalendarPreferenceKey = (prefix: string, locationId?: string | null) =>
  locationId ? `${prefix}:${locationId}` : prefix;

const AdminCalendar: React.FC = () => {
  const { toast } = useToast();
  const copy = useBusinessCopy();
  const { currentLocationId } = useTenant();
  const queryClient = useQueryClient();
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedBarberId, setSelectedBarberId] = useState<string>('all');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [paymentMethodDraft, setPaymentMethodDraft] = useState<'cash' | 'card' | 'bizum' | 'stripe' | 'none'>('none');
  const [priceDraft, setPriceDraft] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [isCurrentTimeIndicatorEnabled, setIsCurrentTimeIndicatorEnabled] = useState(true);
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);
  const [isRefreshingCalendar, setIsRefreshingCalendar] = useState(false);
  const dateFrom = useMemo(
    () => format(currentWeekStart, 'yyyy-MM-dd'),
    [currentWeekStart],
  );
  const dateTo = useMemo(
    () => format(addDays(currentWeekStart, 6), 'yyyy-MM-dd'),
    [currentWeekStart],
  );
  const appointmentsQueryKey = queryKeys.adminCalendar(currentLocationId, dateFrom, dateTo);

  const getProductsTotal = (appointment: Appointment) =>
    appointment.products?.reduce((acc, item) => acc + item.totalPrice, 0) ?? 0;

  const appointmentsQuery = useQuery({
    queryKey: appointmentsQueryKey,
    queryFn: () =>
      getAdminCalendarData({
        dateFrom,
        dateTo,
        sort: 'asc',
      }),
  });
  const barbersQuery = useQuery({
    queryKey: queryKeys.barbers(currentLocationId, undefined, true),
    queryFn: () => fetchBarbersCached({ localId: currentLocationId, includeInactive: true }),
  });
  const servicesQuery = useQuery({
    queryKey: queryKeys.services(currentLocationId, true),
    queryFn: () => fetchServicesCached({ includeArchived: true, localId: currentLocationId }),
  });
  const stripeConfigQuery = useQuery({
    queryKey: queryKeys.adminStripeConfig(currentLocationId),
    queryFn: getAdminStripeConfig,
  });

  const calendarData = appointmentsQuery.data ?? EMPTY_CALENDAR_RESPONSE;
  const appointments = calendarData.items ?? EMPTY_APPOINTMENTS;
  const barbers = barbersQuery.data ?? EMPTY_BARBERS;
  const hasMultipleBarbers = barbers.length > 1;
  const services = servicesQuery.data ?? EMPTY_SERVICES;
  const clients = calendarData.clients ?? EMPTY_CLIENTS;
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
      title: 'No se pudo cargar el calendario',
      description: 'Inténtalo de nuevo en unos segundos.',
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

  useForegroundRefresh(() => {
    void Promise.all([
      appointmentsQuery.refetch(),
      barbersQuery.refetch(),
      servicesQuery.refetch(),
      stripeConfigQuery.refetch(),
    ]);
  });

  useEffect(() => {
    const syncNow = () => setCurrentTime(new Date());
    syncNow();
    const intervalId = window.setInterval(syncNow, 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const savedBarber = readCalendarPreference(
      resolveCalendarPreferenceKey(BARBER_FILTER_STORAGE_PREFIX, currentLocationId),
    );
    const savedIndicator = readCalendarPreference(
      resolveCalendarPreferenceKey(NOW_INDICATOR_STORAGE_PREFIX, currentLocationId),
    );
    setSelectedBarberId(savedBarber || 'all');
    setIsCurrentTimeIndicatorEnabled(savedIndicator === null ? true : savedIndicator === '1');
    setHasLoadedPreferences(true);
  }, [currentLocationId]);

  useEffect(() => {
    if (!hasLoadedPreferences) return;
    writeCalendarPreference(
      resolveCalendarPreferenceKey(BARBER_FILTER_STORAGE_PREFIX, currentLocationId),
      selectedBarberId,
    );
  }, [currentLocationId, hasLoadedPreferences, selectedBarberId]);

  useEffect(() => {
    if (!hasLoadedPreferences) return;
    writeCalendarPreference(
      resolveCalendarPreferenceKey(NOW_INDICATOR_STORAGE_PREFIX, currentLocationId),
      isCurrentTimeIndicatorEnabled ? '1' : '0',
    );
  }, [currentLocationId, hasLoadedPreferences, isCurrentTimeIndicatorEnabled]);

  const getBarber = (id: string) => barbers.find(b => b.id === id);
  const getService = (id: string) => services.find(s => s.id === id);
  const getAppointmentBarberName = (appointment: Appointment) =>
    getBarber(appointment.barberId)?.name ||
    appointment.barberNameSnapshot ||
    `${copy.staff.singular} eliminado`;
  const getClientInfo = (appointment: Appointment) => {
    const user = clients.find((client) => client.id === appointment.userId);
    const isGuest = !user;
    return {
      name: user?.name || appointment.guestName || 'Cliente sin cuenta',
      contact: user?.email || user?.phone || appointment.guestContact || 'Sin datos de contacto',
      isGuest,
    };
  };
  const selectedClientInfo = selectedAppointment ? getClientInfo(selectedAppointment) : null;
  const selectedProductsTotal = selectedAppointment ? getProductsTotal(selectedAppointment) : 0;
  const hasSelectedProducts = selectedProductsTotal > 0;
  const clientsById = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );

  const applyAppointmentUpdate = useCallback((updated: Appointment) => {
    queryClient.setQueryData<AdminCalendarResponse>(appointmentsQueryKey, (previous) => {
      const base = previous ?? EMPTY_CALENDAR_RESPONSE;
      return {
        ...base,
        items: (base.items ?? EMPTY_APPOINTMENTS).map((appointment) =>
          appointment.id === updated.id ? updated : appointment,
        ),
      };
    });
    setSelectedAppointment(updated);
    dispatchAppointmentsUpdated({ source: 'admin-calendar' });
  }, [appointmentsQueryKey, queryClient]);

  useEffect(() => {
    if (!selectedAppointment) return;
    const nextSelected = appointments.find((appointment) => appointment.id === selectedAppointment.id);
    if (!nextSelected) {
      setSelectedAppointment(null);
      return;
    }
    if (nextSelected !== selectedAppointment) {
      setSelectedAppointment(nextSelected);
    }
  }, [appointments, selectedAppointment]);

  useEffect(() => {
    if (!selectedAppointment) {
      setPaymentMethodDraft('none');
      setPriceDraft('');
      setIsEditingPrice(false);
      return;
    }
    setPaymentMethodDraft(selectedAppointment.paymentMethod ?? 'none');
    if (!isEditingPrice) {
      setPriceDraft(formatPriceInput(selectedAppointment.price ?? 0));
    }
  }, [selectedAppointment, isEditingPrice]);

  const handlePaymentMethodChange = async (value: string) => {
    if (!selectedAppointment || isSavingPayment) return;
    if (value === paymentMethodDraft) return;
    setPaymentMethodDraft(value as typeof paymentMethodDraft);
    setIsSavingPayment(true);
    try {
      const updated = await updateAppointment(selectedAppointment.id, {
        paymentMethod: value === 'none' ? null : (value as PaymentMethod),
      });
      applyAppointmentUpdate(updated);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el método de pago.',
        variant: 'destructive',
      });
      setPaymentMethodDraft(selectedAppointment.paymentMethod ?? 'none');
    } finally {
      setIsSavingPayment(false);
    }
  };

  const commitPrice = async () => {
    if (!selectedAppointment || isSavingPrice) return;
    const currentPrice = selectedAppointment.price ?? 0;
    const normalized = priceDraft.trim().replace(',', '.');
    if (!normalized) {
      setPriceDraft(formatPriceInput(currentPrice));
      return;
    }
    const parsed = Number(normalized);
    if (Number.isNaN(parsed) || parsed < 0) {
      toast({
        title: 'Precio inválido',
        description: 'Introduce un importe válido para la cita.',
        variant: 'destructive',
      });
      setPriceDraft(formatPriceInput(currentPrice));
      return;
    }
    if (Math.abs(parsed - currentPrice) < 0.009) {
      setPriceDraft(formatPriceInput(currentPrice));
      return;
    }
    setIsSavingPrice(true);
    try {
      const updated = await updateAppointment(selectedAppointment.id, { price: parsed });
      applyAppointmentUpdate(updated);
      setPriceDraft(formatPriceInput(updated.price ?? parsed));
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el precio final.',
        variant: 'destructive',
      });
      setPriceDraft(formatPriceInput(currentPrice));
    } finally {
      setIsSavingPrice(false);
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const weekContainsCurrentDay = useMemo(
    () => weekDays.some((day) => isSameDay(day, currentTime)),
    [weekDays, currentTime],
  );
  const dayStartForNow = useMemo(
    () => setMinutes(setHours(startOfDay(currentTime), START_HOUR), 0),
    [currentTime],
  );
  const currentTimeMinutes = useMemo(
    () => differenceInMinutes(currentTime, dayStartForNow),
    [currentTime, dayStartForNow],
  );
  const showCurrentTimeLine =
    isCurrentTimeIndicatorEnabled &&
    weekContainsCurrentDay &&
    currentTimeMinutes >= 0 &&
    currentTimeMinutes <= MINUTES_IN_DAY_VIEW;
  const currentTimeOffsetPx = Math.min(
    HOUR_HEIGHT * HOURS.length,
    Math.max(0, currentTimeMinutes * (HOUR_HEIGHT / 60)),
  );

  useEffect(() => {
    if (selectedBarberId === 'all') return;
    if (!barbers.some((barber) => barber.id === selectedBarberId)) {
      setSelectedBarberId('all');
    }
  }, [barbers, selectedBarberId]);

  useEffect(() => {
    if (hasMultipleBarbers) return;
    if (selectedBarberId !== 'all') {
      setSelectedBarberId('all');
    }
  }, [hasMultipleBarbers, selectedBarberId]);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshingCalendar(true);
    try {
      await appointmentsQuery.refetch();
    } finally {
      setIsRefreshingCalendar(false);
    }
  }, [appointmentsQuery]);

  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter((apt) => {
      const aptDate = parseISO(apt.startDateTime);
      const sameDay = isSameDay(aptDate, day);
      const matchesBarber = selectedBarberId === 'all' || apt.barberId === selectedBarberId;
      return sameDay && matchesBarber && apt.status !== 'cancelled';
    });
  };

  const getAppointmentDuration = (apt: Appointment) => {
    const service = getService(apt.serviceId);
    return service?.duration ?? 30;
  };
  const getAppointmentCardTone = (status: Appointment['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-950/80 border-emerald-300/20';
      case 'no_show':
        return 'bg-rose-950/85 border-rose-300/20';
      case 'cancelled':
        return 'bg-slate-700/75 border-slate-300/15';
      default:
        return 'bg-slate-900/85 border-white/15';
    }
  };
  const getAppointmentClientName = (apt: Appointment) => {
    const client = apt.userId ? clientsById.get(apt.userId) : undefined;
    return client?.name || apt.guestName || 'Cliente';
  };

  const buildDayEvents = (day: Date) => {
    const dayStart = setMinutes(setHours(startOfDay(day), START_HOUR), 0);
    const dayEvents = getAppointmentsForDay(day)
      .map((apt) => {
        const start = parseISO(apt.startDateTime);
        const duration = getAppointmentDuration(apt);
        const end = addMinutes(start, duration);
        const startMinutes = Math.max(0, differenceInMinutes(start, dayStart));
        const endMinutes = Math.min(MINUTES_IN_DAY_VIEW, differenceInMinutes(end, dayStart));
        if (endMinutes <= 0 || startMinutes >= MINUTES_IN_DAY_VIEW) {
          return null;
        }
        return {
          appointment: apt,
          start,
          end,
          startMinutes,
          endMinutes,
        };
      })
      .filter((event): event is NonNullable<typeof event> => !!event)
      .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

    const groups: Array<{ events: typeof dayEvents; maxEnd: number }> = [];
    dayEvents.forEach((event) => {
      const lastGroup = groups[groups.length - 1];
      if (!lastGroup || event.startMinutes >= lastGroup.maxEnd) {
        groups.push({ events: [event], maxEnd: event.endMinutes });
        return;
      }
      lastGroup.events.push(event);
      lastGroup.maxEnd = Math.max(lastGroup.maxEnd, event.endMinutes);
    });

    return groups.flatMap((group) => {
      const columnsEnd: number[] = [];
      const withColumns = group.events.map((event) => {
        let columnIndex = columnsEnd.findIndex((end) => event.startMinutes >= end);
        if (columnIndex === -1) {
          columnIndex = columnsEnd.length;
          columnsEnd.push(event.endMinutes);
        } else {
          columnsEnd[columnIndex] = event.endMinutes;
        }
        return {
          ...event,
          column: columnIndex,
        };
      });
      const totalColumns = columnsEnd.length;
      return withColumns.map((event) => ({
        ...event,
        columns: totalColumns,
      }));
    });
  };

  const barberColorsById = useMemo(
    () => new Map(barbers.map((barber) => [barber.id, barber.calendarColor ?? null])),
    [barbers],
  );
  const getBarberAccentColor = (barberId: string) =>
    resolveBarberAccentColor(barberId, barberColorsById.get(barberId));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="pl-12 md:pl-0">
          <h1 className="text-3xl font-bold text-foreground">Calendario</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona las citas {copy.location.fromWithDefinite}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {hasMultipleBarbers && (
            <Select value={selectedBarberId} onValueChange={setSelectedBarberId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={`Filtrar ${copy.staff.singularLower}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{getAllNounLabel(copy.staff)}</SelectItem>
                {barbers.map(barber => (
                  <SelectItem key={barber.id} value={barber.id}>{barber.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm text-muted-foreground">
            <Switch
              checked={isCurrentTimeIndicatorEnabled}
              onCheckedChange={setIsCurrentTimeIndicatorEnabled}
            />
            Indicador hora actual
          </label>
          <Button variant="outline" size="sm" onClick={() => void handleManualRefresh()} disabled={isRefreshingCalendar}>
            <RefreshCcw className={cn('mr-2 h-4 w-4', isRefreshingCalendar && 'animate-spin')} />
            Recargar
          </Button>
        </div>
      </div>

      {/* Calendar Navigation */}
      <Card variant="elevated">
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <CardTitle className="text-lg">
            {format(currentWeekStart, "d 'de' MMMM", { locale: es })} - {format(addDays(currentWeekStart, 6), "d 'de' MMMM yyyy", { locale: es })}
          </CardTitle>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Days Header */}
            <div
              className="grid border-b border-border"
              style={{ gridTemplateColumns: '64px repeat(7, minmax(0, 1fr))' }}
            >
              <div className="p-3 text-center text-sm text-muted-foreground">Hora</div>
              {weekDays.map((day) => (
                <div 
                  key={day.toISOString()} 
                  className={cn(
                    'p-3 text-center border-l border-border',
                    isSameDay(day, new Date()) && 'bg-primary/10'
                  )}
                >
                  <p className="text-xs text-muted-foreground uppercase">
                    {format(day, 'EEE', { locale: es })}
                  </p>
                  <p className={cn(
                    'text-lg font-semibold',
                    isSameDay(day, new Date()) ? 'text-primary' : 'text-foreground'
                  )}>
                    {format(day, 'd')}
                  </p>
                </div>
              ))}
            </div>

            {/* Time Grid */}
            <div
              className="relative grid"
              style={{ gridTemplateColumns: '64px repeat(7, minmax(0, 1fr))' }}
            >
              <div className="border-r border-border">
                {HOURS.map((hour, index) => (
                  <div
                    key={hour}
                    className={cn(
                      'p-2 text-center text-sm text-muted-foreground',
                      index < HOURS.length - 1 && 'border-b border-border'
                    )}
                    style={{ height: HOUR_HEIGHT }}
                  >
                    {hour}:00
                  </div>
                ))}
              </div>
              {weekDays.map((day) => {
                const dayEvents = buildDayEvents(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'relative border-l border-border',
                      isSameDay(day, new Date()) && 'bg-primary/5'
                    )}
                    style={{ height: HOUR_HEIGHT * HOURS.length }}
                  >
                    {HOURS.map((hour, index) => (
                      <div
                        key={`${day.toISOString()}-${hour}`}
                        className={cn(
                          'absolute left-0 right-0 border-b border-border',
                          index === 0 && 'border-t border-border'
                        )}
                        style={{ top: index * HOUR_HEIGHT }}
                      />
                    ))}
                    {dayEvents.map((event) => {
                      const service = getService(event.appointment.serviceId);
                      const startLabel = format(event.start, 'HH:mm');
                      const endLabel = format(event.end, 'HH:mm');
                      const columnWidth = 100 / event.columns;
                      const horizontalGapPx = event.columns > 1 ? 2 : 8;
                      const sideInsetPx = event.columns > 1 ? 1 : 4;
                      const eventHeight = Math.max(18, (event.endMinutes - event.startMinutes) * (HOUR_HEIGHT / 60));
                      const isCompact = eventHeight < 44;
                      const showClient = eventHeight >= 60;
                      return (
                        <button
                          key={event.appointment.id}
                          onClick={() => setSelectedAppointment(event.appointment)}
                          title={`${startLabel} - ${endLabel} · ${service?.name || 'Servicio'}`}
                          className={cn(
                            'absolute overflow-hidden rounded-sm border px-2 py-1 text-left text-[11px] leading-tight text-white shadow-sm transition-all',
                            'hover:-translate-y-[1px] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-1',
                            getAppointmentCardTone(event.appointment.status)
                          )}
                          style={{
                            top: event.startMinutes * (HOUR_HEIGHT / 60),
                            height: eventHeight,
                            left: `calc(${event.column * columnWidth}% + ${sideInsetPx}px)`,
                            width: `calc(${columnWidth}% - ${horizontalGapPx}px)`,
                            borderLeftWidth: 2,
                            borderLeftColor: getBarberAccentColor(event.appointment.barberId),
                          }}
                        >
                          <AppointmentNoteIndicator
                            note={event.appointment.notes}
                            variant="icon"
                            className="absolute right-1 top-1 border-white/40 bg-white/20 text-white/90"
                          />
                          <div className="pr-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold tabular-nums">{startLabel}</span>
                              {!isCompact && <span className="text-white/70">- {endLabel}</span>}
                            </div>
                            <div className={cn('truncate font-medium text-white/95', isCompact && 'text-[10px]')}>
                              {service?.name || 'Servicio'}
                            </div>
                            {!isCompact && event.appointment.subscriptionApplied && (
                              <div className="mt-0.5 inline-flex rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-100">
                                Susc
                              </div>
                            )}
                            {showClient && (
                              <div className="truncate text-[10px] text-white/75">
                                {getAppointmentClientName(event.appointment)}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {showCurrentTimeLine && (
                <div
                  className="pointer-events-none absolute z-30"
                  style={{ top: 0, bottom: 0, left: 0, right: 0 }}
                >
                  <div
                    className="absolute right-0 border-t-2 border-rose-500"
                    style={{ left: 64, top: currentTimeOffsetPx }}
                  />
                  <div className="absolute left-1 -translate-y-1/2 rounded bg-rose-500/55 px-1.5 py-0.5 text-[10px] font-semibold text-white/95 shadow" style={{ top: currentTimeOffsetPx }}>
                    {format(currentTime, 'HH:mm')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appointment Detail Modal */}
      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle de cita</DialogTitle>
            <DialogDescription className="sr-only">
              Vista completa de la cita, estado, cliente, servicio y método de pago.
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                <Scissors className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Servicio</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">
                      {getService(selectedAppointment.serviceId)?.name}
                    </p>
                    {selectedAppointment.subscriptionApplied && (
                      <Badge variant="secondary">Suscripción</Badge>
                    )}
                  </div>
                </div>
              </div>

              {hasSelectedProducts && (
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Package className="w-4 h-4 text-primary" />
                      Productos añadidos
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Total productos: {currencyFormatter.format(selectedProductsTotal)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {selectedAppointment.products?.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} x {currencyFormatter.format(item.unitPrice)}
                          </p>
                        </div>
                        <span className="font-semibold text-foreground">
                          {currencyFormatter.format(item.totalPrice)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                <UserIcon className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium text-foreground">
                    {selectedClientInfo?.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedClientInfo?.contact}
                  </p>
                  {selectedClientInfo?.isGuest && (
                    <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-400">
                      Invitado sin cuenta
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                <img 
                  src={getBarber(selectedAppointment.barberId)?.photo || defaultAvatar}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm text-muted-foreground">{copy.staff.singular}</p>
                  <p className="font-medium text-foreground">
                    {getAppointmentBarberName(selectedAppointment)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Fecha y hora</p>
                  <p className="font-medium text-foreground">
                    {format(parseISO(selectedAppointment.startDateTime), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                  </p>
                </div>
              </div>

              {selectedAppointment.notes?.trim() && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <MessageSquare className="h-4 w-4" />
                    Comentario del cliente
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedAppointment.notes}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <AppointmentStatusPicker
                    appointment={selectedAppointment}
                    serviceDurationMinutes={getService(selectedAppointment.serviceId)?.duration ?? 30}
                    onStatusUpdated={applyAppointmentUpdate}
                  />
                  <Select
                    value={paymentMethodDraft}
                    onValueChange={handlePaymentMethodChange}
                    disabled={isSavingPayment}
                  >
                    <SelectTrigger className="h-8 w-[140px] rounded-full bg-background/70 px-3 text-xs">
                      <SelectValue placeholder="Método de pago" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Efectivo</SelectItem>
                      <SelectItem value="card">Tarjeta</SelectItem>
                      <SelectItem value="bizum">Bizum</SelectItem>
                      {stripeEnabled && <SelectItem value="stripe">Stripe</SelectItem>}
                      {!stripeEnabled && paymentMethodDraft === 'stripe' && (
                        <SelectItem value="stripe" disabled>
                          Stripe
                        </SelectItem>
                      )}
                      <SelectItem value="none">Sin método</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-1.5">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={priceDraft}
                      onFocus={(event) => {
                        setIsEditingPrice(true);
                        event.currentTarget.select();
                      }}
                      onBlur={() => {
                        setIsEditingPrice(false);
                        void commitPrice();
                      }}
                      onChange={(event) => setPriceDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.currentTarget.blur();
                        }
                        if (event.key === 'Escape') {
                          setPriceDraft(formatPriceInput(selectedAppointment.price ?? 0));
                          event.currentTarget.blur();
                        }
                      }}
                      className="w-[60px] bg-transparent text-center text-xl font-bold text-primary outline-none sm:w-[72px]"
                      aria-label="Precio final"
                      disabled={isSavingPrice}
                    />
                    <span className="text-sm font-semibold text-primary">€</span>
                    {isSavingPrice && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </div>
                  {hasSelectedProducts && (
                    <p className="text-xs text-muted-foreground">
                      Incluye {currencyFormatter.format(selectedProductsTotal)} en productos
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSelectedAppointment(null)}>
                  Cerrar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingAppointment(selectedAppointment);
                    setIsEditorOpen(true);
                  }}
                >
                  Editar
                </Button>
                <Button variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(selectedAppointment)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
          setSelectedAppointment(null);
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
                  setSelectedAppointment(null);
                  dispatchAppointmentsUpdated({ source: 'admin-calendar' });
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

export default AdminCalendar;
