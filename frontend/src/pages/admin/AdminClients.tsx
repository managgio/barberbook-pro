import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAppointments, getBarbers, getServices, getUsers, updateAppointment } from '@/data/api';
import { Appointment, Barber, Service, User } from '@/data/types';
import { Search, User as UserIcon, Mail, Phone, Calendar, Pencil, Trash2, HelpCircle } from 'lucide-react';
import { format, parseISO, subMonths, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import EmptyState from '@/components/common/EmptyState';
import { ListSkeleton } from '@/components/common/Skeleton';
import AppointmentEditorDialog from '@/components/common/AppointmentEditorDialog';
import AppointmentNoteIndicator from '@/components/common/AppointmentNoteIndicator';
import AppointmentStatusPicker from '@/components/common/AppointmentStatusPicker';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { ADMIN_EVENTS, dispatchAppointmentsUpdated } from '@/lib/adminEvents';

const AdminClients: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<User[]>([]);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
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

  useEffect(() => {
    const interval = setInterval(() => {
      void loadData(false);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  const filteredClients = clients.filter(client => {
    const haystack = `${client.name} ${client.email || ''} ${client.phone || ''}`.toLowerCase();
    return haystack.includes(searchTerm.toLowerCase());
  });

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const getClientAppointments = useCallback(
    (clientId: string) =>
      appointments
        .filter((appointment) => appointment.userId === clientId)
        .sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime()),
    [appointments]
  );

  const selectedClientAppointments = useMemo(
    () => (selectedClient ? getClientAppointments(selectedClient.id) : []),
    [selectedClient, getClientAppointments]
  );
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="pl-12 md:pl-0">
        <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
        <p className="text-muted-foreground mt-1">
          Busca clientes y consulta su historial de citas.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Client List */}
        <Card variant="elevated" className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-primary" />
              Lista de clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {isLoading ? (
              <ListSkeleton count={5} />
            ) : filteredClients.length > 0 ? (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredClients.map((client) => (
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
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                No se encontraron clientes
              </p>
            )}
          </CardContent>
        </Card>

        {/* Client Details */}
        <Card variant="elevated" className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Historial del cliente</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedClient ? (
              <div className="space-y-6">
                {/* Client Info */}
                <div className="p-4 bg-secondary/50 rounded-lg space-y-3 relative">
                  {recentNoShows > 0 && (
                    <div className="absolute top-3 right-3 rounded-full bg-destructive/10 text-destructive text-xs font-semibold px-2 py-1 inline-flex items-center gap-1">
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
                          Datos de los últimos 2 meses.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg text-foreground">{selectedClient.name}</p>
                      <p className="text-sm text-muted-foreground">Cliente registrado</p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 pt-2">
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
                </div>

                {/* Appointments */}
                <div>
                  <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Historial de citas ({selectedClientAppointments.length})
                  </h4>
                  {selectedClientAppointments.length > 0 ? (
                    <div className="space-y-2">
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
                          <div className="flex items-center gap-2">
                            <AppointmentStatusPicker
                              appointment={apt}
                              serviceDurationMinutes={getService(apt.serviceId)?.duration ?? 30}
                              onStatusUpdated={(updated) => {
                                setAppointments((prev) =>
                                  prev.map((appointment) =>
                                    appointment.id === updated.id ? updated : appointment,
                                  ),
                                );
                                dispatchAppointmentsUpdated({ source: 'admin-clients' });
                              }}
                            />
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
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      Este cliente no tiene citas registradas
                    </p>
                  )}
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
          await loadData();
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
                  await loadData();
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
