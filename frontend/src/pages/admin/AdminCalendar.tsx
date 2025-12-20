import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { 
  format, 
  startOfWeek, 
  addDays, 
  addWeeks, 
  subWeeks,
  parseISO,
  isSameDay,
  startOfDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import AppointmentEditorDialog from '@/components/common/AppointmentEditorDialog';
import { useToast } from '@/hooks/use-toast';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 9); // 9:00 - 20:00

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

  const loadData = async () => {
    setIsLoading(true);
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
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const getAppointmentsForSlot = (day: Date, hour: number) => {
    return appointments.filter(apt => {
      const aptDate = parseISO(apt.startDateTime);
      const aptHour = aptDate.getHours();
      const sameDay = isSameDay(aptDate, day);
      const sameHour = aptHour === hour || (aptHour === hour - 0.5);
      const matchesBarber = selectedBarberId === 'all' || apt.barberId === selectedBarberId;
      return sameDay && sameHour && matchesBarber && apt.status !== 'cancelled';
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
        <div>
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
            <div className="grid grid-cols-8 border-b border-border">
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

            {/* Time Slots */}
            {HOURS.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b border-border">
                <div className="p-2 text-center text-sm text-muted-foreground border-r border-border">
                  {hour}:00
                </div>
                {weekDays.map((day) => {
                  const dayAppointments = getAppointmentsForSlot(day, hour);
                  return (
                    <div 
                      key={`${day.toISOString()}-${hour}`} 
                      className="min-h-[60px] p-1 border-l border-border hover:bg-secondary/30 transition-colors"
                    >
                      {dayAppointments.map((apt) => {
                        const service = getService(apt.serviceId);
                        return (
                          <button
                            key={apt.id}
                            onClick={() => setSelectedAppointment(apt)}
                            className={cn(
                              'w-full text-left p-1.5 rounded text-xs text-white truncate mb-1 transition-opacity hover:opacity-80',
                              barberColors[apt.barberId] || 'bg-primary/80'
                            )}
                          >
                            {format(parseISO(apt.startDateTime), 'HH:mm')} - {service?.name}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
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
                  src={getBarber(selectedAppointment.barberId)?.photo}
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
