import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAppointmentsByUser, getBarbers, getServices, deleteAppointment } from '@/data/api';
import { Appointment, Barber, Service } from '@/data/types';
import { Calendar, Clock, MapPin, User, CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import EmptyState from '@/components/common/EmptyState';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useNavigate } from 'react-router-dom';
import AppointmentEditorDialog from '@/components/common/AppointmentEditorDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import defaultAvatar from '@/assets/img/default-avatar.svg';
import { useSiteSettings } from '@/hooks/useSiteSettings';

const AppointmentsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { settings } = useSiteSettings();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const [appts, barbersData, servicesData] = await Promise.all([
      getAppointmentsByUser(user.id),
      getBarbers(),
      getServices(),
    ]);
    setAppointments(appts);
    setBarbers(barbersData);
    setServices(servicesData);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const upcomingAppointments = appointments
    .filter(a => !isPast(parseISO(a.startDateTime)) && a.status === 'confirmed')
    .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());

  const pastAppointments = appointments
    .filter(a => isPast(parseISO(a.startDateTime)) || a.status === 'completed')
    .sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());

  const getBarber = (id: string) => barbers.find(b => b.id === id);
  const getService = (id: string) => services.find(s => s.id === id);

  const generateCalendarLink = (appointment: Appointment) => {
    const service = getService(appointment.serviceId);
    const barber = getBarber(appointment.barberId);
    const startDate = parseISO(appointment.startDateTime);
    const durationMinutes = service?.duration ?? 30;
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
    
    const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${service?.name} - ${settings.branding.name}`,
      dates: `${formatDate(startDate)}/${formatDate(endDate)}`,
      details: `Cita con ${barber?.name}`,
      location: settings.location.label,
    });
    
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const AppointmentCard: React.FC<{ appointment: Appointment; isPast?: boolean }> = ({ 
    appointment, 
    isPast: isHistorical = false 
  }) => {
    const barber = getBarber(appointment.barberId);
    const service = getService(appointment.serviceId);
    const date = parseISO(appointment.startDateTime);
    
    return (
      <Card variant={isHistorical ? 'default' : 'elevated'} className={isHistorical ? 'opacity-70' : ''}>
        <CardContent className="p-6 relative">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <img 
              src={barber?.photo || defaultAvatar} 
              alt={barber?.name}
              className="w-16 h-16 rounded-xl object-cover"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-lg">{service?.name}</h3>
              <p className="text-muted-foreground">con {barber?.name}</p>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(date, "EEEE d 'de' MMMM", { locale: es })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {format(date, 'HH:mm')}
                </span>
                <a
                  className="flex items-center gap-1 text-primary hover:underline"
                  href={settings.location.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin className="w-4 h-4" />
                  {settings.location.label}
                </a>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                appointment.status === 'confirmed' 
                  ? 'bg-primary/10 text-primary' 
                  : appointment.status === 'completed'
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {appointment.status === 'confirmed' ? 'Confirmada' : 
                 appointment.status === 'completed' ? 'Completada' : 'Cancelada'}
              </span>
              <span className="text-xl font-bold text-primary">{service?.price}€</span>
            </div>
          </div>
          {!isHistorical && (
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="md:order-1"
              >
                <a href={generateCalendarLink(appointment)} target="_blank" rel="noopener noreferrer">
                  <CalendarPlus className="w-4 h-4 mr-1" />
                  Añadir al calendario
                </a>
              </Button>
              <div className="absolute top-4 right-4 flex gap-2 md:static md:order-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setEditingAppointment(appointment);
                    setIsEditorOpen(true);
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => setDeleteTarget(appointment)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Mis citas</h1>
        <p className="text-muted-foreground mt-1">
          Consulta y gestiona todas tus reservas.
        </p>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="upcoming">
            Próximas ({upcomingAppointments.length})
          </TabsTrigger>
          <TabsTrigger value="past">
            Pasadas ({pastAppointments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          {isLoading ? (
            <ListSkeleton count={3} />
          ) : upcomingAppointments.length > 0 ? (
            <div className="space-y-4">
              {upcomingAppointments.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Calendar}
              title="No tienes citas próximas"
              description="Reserva tu próxima cita y mantén tu estilo impecable."
              action={{
                label: 'Reservar ahora',
                onClick: () => navigate('/app/book'),
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-6">
          {isLoading ? (
            <ListSkeleton count={3} />
          ) : pastAppointments.length > 0 ? (
            <div className="space-y-4">
              {pastAppointments.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} isPast />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Clock}
              title="Sin historial de citas"
              description="Aquí aparecerán tus citas completadas."
            />
          )}
       </TabsContent>
     </Tabs>

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
        }}
        context="client"
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
            <AlertDialogCancel disabled={isDeleting}>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                setIsDeleting(true);
                try {
                  await deleteAppointment(deleteTarget.id);
                  toast({ title: 'Cita cancelada', description: 'Tu cita ha sido cancelada correctamente.' });
                  setDeleteTarget(null);
                  await loadData();
                } catch (error) {
                  toast({ title: 'Error', description: 'No se pudo cancelar la cita.', variant: 'destructive' });
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

export default AppointmentsPage;
