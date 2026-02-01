import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAppointments, getBarbers, getServices, getUsers, updateAppointment } from '@/data/api';
import { Appointment, Barber, Service, User } from '@/data/types';
import { Search, Calendar, Clock, Pencil, Trash2 } from 'lucide-react';
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
import { ADMIN_EVENTS, dispatchAppointmentsUpdated } from '@/lib/adminEvents';

const AdminSearch: React.FC = () => {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedBarberId, setSelectedBarberId] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
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

  useEffect(() => {
    let filtered = [...appointments];

    if (selectedBarberId !== 'all') {
      filtered = filtered.filter(a => a.barberId === selectedBarberId);
    }

    if (selectedDate) {
      filtered = filtered.filter(a => a.startDateTime.startsWith(selectedDate));
    }

    filtered.sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());
    setFilteredAppointments(filtered);
  }, [appointments, selectedBarberId, selectedDate]);

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
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="pl-12 md:pl-0">
        <h1 className="text-3xl font-bold text-foreground">Buscar citas</h1>
        <p className="text-muted-foreground mt-1">
          Busca citas por barbero y fecha.
        </p>
      </div>

      {/* Filters */}
      <Card variant="elevated">
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Barbero</Label>
              <Select value={selectedBarberId} onValueChange={setSelectedBarberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar barbero" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los barberos</SelectItem>
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
                onChange={(e) => setSelectedDate(e.target.value)}
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
            Resultados ({filteredAppointments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ListSkeleton count={5} />
          ) : filteredAppointments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Fecha</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Hora</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Servicio</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Barbero</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Estado</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.map((apt) => {
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
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <span className="text-foreground">{getBarber(apt.barberId)?.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <AppointmentStatusPicker
                          appointment={apt}
                          serviceDurationMinutes={getService(apt.serviceId)?.duration ?? 30}
                          onStatusUpdated={(updated) => {
                            setAppointments((prev) =>
                              prev.map((appointment) =>
                                appointment.id === updated.id ? updated : appointment,
                              ),
                            );
                            dispatchAppointmentsUpdated({ source: 'admin-search' });
                          }}
                        />
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
                  dispatchAppointmentsUpdated({ source: 'admin-search' });
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

export default AdminSearch;
