import React, { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAppointmentsByUser, updateAppointment } from '@/data/api/appointments';
import { getBarbers } from '@/data/api/barbers';
import { getServices } from '@/data/api/services';
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
import defaultAvatar from '@/assets/img/default-image.webp';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { getAppointmentStatusBadgeClass, getAppointmentStatusLabel, isAppointmentUpcomingStatus } from '@/lib/appointmentStatus';
import { useBusinessCopy } from '@/lib/businessCopy';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getStoredLocalId } from '@/lib/tenant';

const EMPTY_APPOINTMENTS: Appointment[] = [];
const EMPTY_BARBERS: Barber[] = [];
const EMPTY_SERVICES: Service[] = [];

const AppointmentsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { settings } = useSiteSettings();
  const { toast } = useToast();
  const copy = useBusinessCopy();
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const localId = getStoredLocalId();
  const userId = user?.id;

  const appointmentsQuery = useQuery<Appointment[]>({
    queryKey: queryKeys.clientAppointments(localId, userId),
    queryFn: () => getAppointmentsByUser(userId as string),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  const barbersQuery = useQuery<Barber[]>({
    queryKey: queryKeys.barbers(localId),
    queryFn: () => getBarbers(),
    enabled: Boolean(userId),
  });

  const servicesQuery = useQuery<Service[]>({
    queryKey: queryKeys.services(localId, false),
    queryFn: () => getServices(),
    enabled: Boolean(userId),
  });

  const appointments = useMemo(
    () => appointmentsQuery.data ?? EMPTY_APPOINTMENTS,
    [appointmentsQuery.data],
  );
  const barbers = useMemo(
    () => barbersQuery.data ?? EMPTY_BARBERS,
    [barbersQuery.data],
  );
  const services = useMemo(
    () => servicesQuery.data ?? EMPTY_SERVICES,
    [servicesQuery.data],
  );
  const isLoading = appointmentsQuery.isLoading || barbersQuery.isLoading || servicesQuery.isLoading;

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            !isPast(parseISO(appointment.startDateTime)) && isAppointmentUpcomingStatus(appointment.status),
        )
        .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()),
    [appointments],
  );

  const pastAppointments = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            isPast(parseISO(appointment.startDateTime)) ||
            appointment.status === 'completed' ||
            appointment.status === 'cancelled' ||
            appointment.status === 'no_show',
        )
        .sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime()),
    [appointments],
  );

  const barbersById = useMemo(
    () => new Map(barbers.map((barber) => [barber.id, barber])),
    [barbers],
  );
  const servicesById = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services],
  );

  const cancellationCutoffHours = settings.appointments?.cancellationCutoffHours ?? 0;
  const canCancelAppointment = (appointment: Appointment) => {
    if (cancellationCutoffHours <= 0) return true;
    const startDate = parseISO(appointment.startDateTime);
    const cutoffMs = cancellationCutoffHours * 60 * 60 * 1000;
    return startDate.getTime() - Date.now() > cutoffMs;
  };

  const generateCalendarLink = (appointment: Appointment) => {
    const service = servicesById.get(appointment.serviceId);
    const barber = barbersById.get(appointment.barberId);
    const serviceName = service?.name ?? appointment.serviceNameSnapshot ?? 'Servicio';
    const barberName = barber?.name ?? appointment.barberNameSnapshot ?? copy.staff.singular;
    const startDate = parseISO(appointment.startDateTime);
    const durationMinutes = service?.duration ?? 30;
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
    
    const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${serviceName} - ${settings.branding.name}`,
      dates: `${formatDate(startDate)}/${formatDate(endDate)}`,
      details: `Cita con ${barberName}`,
      location: settings.location.label,
    });
    
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const AppointmentCard: React.FC<{ appointment: Appointment; isPast?: boolean }> = ({ 
    appointment, 
    isPast: isHistorical = false 
  }) => {
    const barber = barbersById.get(appointment.barberId);
    const service = servicesById.get(appointment.serviceId);
    const barberName = barber?.name ?? appointment.barberNameSnapshot ?? `${copy.staff.singular} eliminado`;
    const serviceName = service?.name ?? appointment.serviceNameSnapshot ?? 'Servicio eliminado';
    const date = parseISO(appointment.startDateTime);
    const basePrice = service?.price ?? appointment.price;
    const paidPrice = appointment.price;
    const hadOffer = paidPrice < (basePrice - 0.001);
    const canCancel = canCancelAppointment(appointment);
    
    return (
      <Card variant={isHistorical ? 'default' : 'elevated'} className={isHistorical ? 'opacity-70' : ''}>
        <CardContent className="p-6 relative">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <img 
              src={barber?.photo || defaultAvatar} 
              alt={barberName}
              loading="lazy"
              decoding="async"
              width={64}
              height={64}
              className="w-16 h-16 rounded-xl object-cover"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-lg">{serviceName}</h3>
              <p className="text-muted-foreground">con {barberName}</p>
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
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${getAppointmentStatusBadgeClass(
                  appointment.status,
                )}`}
              >
                {getAppointmentStatusLabel(appointment.status)}
              </span>
              <div className="text-right">
                {hadOffer && (
                  <div className="text-xs line-through text-muted-foreground">
                    {basePrice.toFixed(2)}€
                  </div>
                )}
                <span className="text-xl font-bold text-primary">{paidPrice.toFixed(2)}€</span>
                {hadOffer && <div className="text-[11px] text-green-600">Precio promocional</div>}
              </div>
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
                  onClick={() => {
                    if (!canCancel) return;
                    setDeleteTarget(appointment);
                  }}
                  disabled={!canCancel}
                  title={
                    !canCancel
                      ? `No puedes cancelar con menos de ${cancellationCutoffHours}h de antelación.`
                      : undefined
                  }
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
          await appointmentsQuery.refetch();
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
              Esta acción no se puede deshacer. La cita quedará marcada como cancelada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget || !canCancelAppointment(deleteTarget)) return;
                setIsDeleting(true);
                try {
                  await updateAppointment(deleteTarget.id, { status: 'cancelled' });
                  toast({ title: 'Cita cancelada', description: 'Tu cita ha sido cancelada correctamente.' });
                  setDeleteTarget(null);
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

export default AppointmentsPage;
