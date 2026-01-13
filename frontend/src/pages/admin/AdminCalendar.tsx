import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getAppointments, getBarbers, getServices, getUsers, deleteAppointment } from '@/data/api';
import { Appointment, Barber, Service, User } from '@/data/types';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  User as UserIcon,
  Scissors,
  MessageSquare,
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
import { useToast } from '@/hooks/use-toast';
import defaultAvatar from '@/assets/img/default-avatar.svg';
import { ADMIN_EVENTS, dispatchAppointmentsUpdated } from '@/lib/adminEvents';

const START_HOUR = 9;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);
const HOUR_HEIGHT = 60;
const MINUTES_IN_DAY_VIEW = HOURS.length * 60;

const AdminCalendar: React.FC = () => {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedBarberId, setSelectedBarberId] = useState<string>('all');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async (withLoading = true) => {
    if (withLoading) setIsLoading(true);
    try {
      const [appts, barbersData, servicesData, usersData] = await Promise.all([
        getAppointments(),
        getBarbers(),
        getServices(),
        getUsers(),
      ]);
      setAppointments(appts);
      setBarbers(barbersData);
      setServices(servicesData);
      setClients(usersData.filter((user) => user.role === 'client'));
    } finally {
      if (withLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadData(false);
    };
    window.addEventListener(ADMIN_EVENTS.appointmentsUpdated, handleRefresh);
    return () => window.removeEventListener(ADMIN_EVENTS.appointmentsUpdated, handleRefresh);
  }, [loadData]);

  const getBarber = (id: string) => barbers.find(b => b.id === id);
  const getService = (id: string) => services.find(s => s.id === id);
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

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

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

  const barberColors: Record<string, string> = {
    'barber-1': 'bg-primary/80',
    'barber-2': 'bg-blue-500/80',
    'barber-3': 'bg-green-500/80',
    'barber-4': 'bg-purple-500/80',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="pl-12 md:pl-0">
          <h1 className="text-3xl font-bold text-foreground">Calendario</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona las citas de la barbería.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedBarberId} onValueChange={setSelectedBarberId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar barbero" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los barberos</SelectItem>
              {barbers.map(barber => (
                <SelectItem key={barber.id} value={barber.id}>{barber.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              className="grid"
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
                      return (
                        <button
                          key={event.appointment.id}
                          onClick={() => setSelectedAppointment(event.appointment)}
                          title={`${startLabel} - ${endLabel} · ${service?.name || 'Servicio'}`}
                          className={cn(
                            'relative absolute rounded text-[11px] leading-tight text-white px-2 py-1 overflow-hidden transition-opacity hover:opacity-80',
                            barberColors[event.appointment.barberId] || 'bg-primary/80'
                          )}
                          style={{
                            top: event.startMinutes * (HOUR_HEIGHT / 60),
                            height: Math.max(18, (event.endMinutes - event.startMinutes) * (HOUR_HEIGHT / 60)),
                            left: `calc(${event.column * columnWidth}% + 4px)`,
                            width: `calc(${columnWidth}% - 8px)`,
                          }}
                        >
                          <AppointmentNoteIndicator
                            note={event.appointment.notes}
                            variant="icon"
                            className="absolute right-1 top-1 border-white/40 bg-white/20 text-white/90"
                          />
                          <div className="font-semibold">{startLabel} - {endLabel}</div>
                          <div className="truncate">{service?.name || 'Servicio'}</div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appointment Detail Modal */}
      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle de cita</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                <Scissors className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Servicio</p>
                  <p className="font-medium text-foreground">
                    {getService(selectedAppointment.serviceId)?.name}
                  </p>
                </div>
              </div>

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
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm text-muted-foreground">Barbero</p>
                  <p className="font-medium text-foreground">
                    {getBarber(selectedAppointment.barberId)?.name}
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

              <div className="flex items-center justify-between pt-2">
                <span className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium',
                  selectedAppointment.status === 'confirmed' 
                    ? 'bg-primary/10 text-primary' 
                    : selectedAppointment.status === 'completed'
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {selectedAppointment.status === 'confirmed' ? 'Confirmada' : 
                   selectedAppointment.status === 'completed' ? 'Completada' : 'Cancelada'}
                </span>
                <span className="text-xl font-bold text-primary">
                  {getService(selectedAppointment.serviceId)?.price}€
                </span>
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
                  Eliminar
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
          await loadData();
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
              Esta acción no se puede deshacer. La cita será eliminada permanentemente.
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
                  await deleteAppointment(deleteTarget.id);
                  toast({ title: 'Cita eliminada', description: 'La cita ha sido cancelada.' });
                  setDeleteTarget(null);
                  setSelectedAppointment(null);
                  dispatchAppointmentsUpdated({ source: 'admin-calendar' });
                  await loadData();
                } catch (error) {
                  toast({ title: 'Error', description: 'No se pudo eliminar la cita.', variant: 'destructive' });
                } finally {
                  setIsDeleting(false);
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCalendar;
