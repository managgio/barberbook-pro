import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getUsers, getBarbers, getServices, getAvailableSlots, createAppointment, getServiceCategories, getSiteSettings } from '@/data/api';
import { Barber, Service, ServiceCategory, User } from '@/data/types';
import { Plus, Search, Loader2, UserCircle2, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const QuickAppointmentButton: React.FC = () => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [clients, setClients] = useState<User[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [categoriesEnabled, setCategoriesEnabled] = useState(false);

  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [useGuest, setUseGuest] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestContact, setGuestContact] = useState('');

  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedBarberId, setSelectedBarberId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const [usersData, barbersData, servicesData, categoriesData, settingsData] = await Promise.all([
          getUsers(),
          getBarbers(),
          getServices(),
          getServiceCategories(true),
          getSiteSettings(),
        ]);
        setClients(usersData.filter((user) => user.role === 'client'));
        setBarbers(barbersData);
        setServices(servicesData);
        setServiceCategories(categoriesData);
        setCategoriesEnabled(settingsData.services.categoriesEnabled);
      } catch (error) {
        console.error(error);
        toast({
          title: 'Error',
          description: 'No se pudo cargar la información para crear citas.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [toast]);

  useEffect(() => {
    if (!selectedBarberId || !selectedDate || !selectedServiceId) {
      setAvailableSlots([]);
      setSelectedTime('');
      return;
    }

    const fetchSlots = async () => {
      setSlotsLoading(true);
      try {
        const slots = await getAvailableSlots(selectedBarberId, selectedDate, {
          serviceId: selectedServiceId,
        });
        setAvailableSlots(slots);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudo cargar la disponibilidad del barbero.',
          variant: 'destructive',
        });
      } finally {
        setSlotsLoading(false);
      }
    };

    fetchSlots();
  }, [selectedBarberId, selectedDate, selectedServiceId, toast]);

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) return [];
    return clients.filter((client) =>
      `${client.name} ${client.email} ${client.phone || ''}`
        .toLowerCase()
        .includes(query)
    );
  }, [clients, clientSearch]);

  const slotGroups = useMemo(() => {
    const morning: string[] = [];
    const afternoon: string[] = [];
    availableSlots.forEach((slot) => {
      const hour = parseInt(slot.split(':')[0], 10);
      if (hour < 14) {
        morning.push(slot);
      } else {
        afternoon.push(slot);
      }
    });
    return { morning, afternoon };
  }, [availableSlots]);

  const orderedCategories = useMemo(
    () =>
      [...serviceCategories].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name),
      ),
    [serviceCategories],
  );

  const uncategorizedServices = useMemo(
    () => services.filter((service) => !service.categoryId),
    [services],
  );

  const resetForm = () => {
    setClientSearch('');
    setSelectedClientId(null);
    setUseGuest(false);
    setGuestName('');
    setGuestContact('');
    setSelectedServiceId('');
    setSelectedBarberId('');
    setSelectedDate('');
    setSelectedTime('');
    setAvailableSlots([]);
  };

  const handleOpenChange = (value: boolean) => {
    setIsOpen(value);
    if (!value) {
      resetForm();
    }
  };

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setUseGuest(false);
  };

  const canCreate = useMemo(() => {
    const hasClient = useGuest ? guestName.trim().length > 0 : !!selectedClientId;
    return (
      hasClient &&
      selectedServiceId &&
      selectedBarberId &&
      selectedDate &&
      selectedTime &&
      !isSubmitting
    );
  }, [useGuest, guestName, selectedClientId, selectedServiceId, selectedBarberId, selectedDate, selectedTime, isSubmitting]);

  const handleCreateAppointment = async () => {
    if (!canCreate) return;
    try {
      setIsSubmitting(true);
      const appointmentDate = new Date(`${selectedDate}T${selectedTime}:00`);
      await createAppointment({
        userId: useGuest ? `guest-${Date.now()}` : (selectedClientId as string),
        barberId: selectedBarberId,
        serviceId: selectedServiceId,
        startDateTime: appointmentDate.toISOString(),
        status: 'confirmed',
        guestName: useGuest ? guestName : undefined,
        guestContact: useGuest ? guestContact : undefined,
      });
      toast({
        title: 'Cita creada',
        description: 'La reserva se ha registrado correctamente.',
      });
      handleOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'No se pudo crear la cita. Intenta de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-glow z-50"
        variant="glow"
        size="icon"
        onClick={() => handleOpenChange(true)}
      >
        <Plus className="w-6 h-6" />
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Crear nueva cita</DialogTitle>
            <DialogDescription>
              Registra una cita manual para clientes habituales o visitas sin cuenta.
            </DialogDescription>
          </DialogHeader>

          {isLoadingData ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Client selection */}
              <div className="space-y-3">
                <Label className="text-base text-foreground block">Cliente</Label>
                <div className="inline-flex rounded-2xl border border-border bg-muted/50 p-1">
                  <button
                    type="button"
                    onClick={() => setUseGuest(false)}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2',
                      !useGuest
                        ? 'bg-background text-foreground shadow'
                        : 'text-muted-foreground'
                    )}
                  >
                    <UserCircle2 className="w-4 h-4" />
                    Registrado
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUseGuest(true);
                      setSelectedClientId(null);
                    }}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2',
                      useGuest
                        ? 'bg-background text-foreground shadow'
                        : 'text-muted-foreground'
                    )}
                  >
                    <Plus className="w-4 h-4" />
                    Sin cuenta
                  </button>
                </div>

                {!useGuest ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Busca por nombre, email o teléfono"
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-2xl border border-border divide-y divide-border/60">
                      {filteredClients.length === 0 ? (
                        <p className="text-sm text-muted-foreground px-4 py-3">
                          No se encontraron clientes
                        </p>
                      ) : (
                        filteredClients.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => handleSelectClient(client.id)}
                            className={cn(
                              'w-full text-left px-4 py-3 hover:bg-secondary/40 transition-colors',
                              selectedClientId === client.id && 'bg-primary/10 text-primary'
                            )}
                          >
                            <p className="font-medium">{client.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {client.email} {client.phone ? `· ${client.phone}` : ''}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                    {selectedClientId && (
                      <p className="text-xs text-muted-foreground">
                        Cliente seleccionado: {clients.find((c) => c.id === selectedClientId)?.name}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="guestName">Nombre completo</Label>
                      <Input
                        id="guestName"
                        placeholder="Introduce el nombre del cliente"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="guestContact">Contacto (teléfono o email)</Label>
                      <Input
                        id="guestContact"
                        placeholder="Opcional, pero recomendado"
                        value={guestContact}
                        onChange={(e) => setGuestContact(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Service & barber */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Servicio</Label>
                  <Select
                    value={selectedServiceId}
                    onValueChange={(value) => {
                      setSelectedServiceId(value);
                      setSelectedTime('');
                      setAvailableSlots([]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un servicio" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriesEnabled && orderedCategories.length > 0 ? (
                        <>
                          {orderedCategories.map((category, index) => {
                            const servicesByCategory =
                              category.services && category.services.length > 0
                                ? category.services
                                : services.filter((service) => service.categoryId === category.id);
                            if (servicesByCategory.length === 0) return null;
                            const showSeparator = index < orderedCategories.length - 1 || uncategorizedServices.length > 0;
                            return (
                              <React.Fragment key={category.id}>
                                <SelectGroup>
                                  <SelectLabel>{category.name}</SelectLabel>
                                  {servicesByCategory.map((service) => (
                                  <SelectItem key={service.id} value={service.id}>
                                    {service.name} · {(service.finalPrice ?? service.price).toFixed(2)}€ · {service.duration} min
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                                {showSeparator && <SelectSeparator />}
                              </React.Fragment>
                            );
                          })}
                          {uncategorizedServices.length > 0 && (
                            <SelectGroup>
                              <SelectLabel>Otros</SelectLabel>
                              {uncategorizedServices.map((service) => (
                                <SelectItem key={service.id} value={service.id}>
                                  {service.name} · {(service.finalPrice ?? service.price).toFixed(2)}€ · {service.duration} min
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                        </>
                      ) : (
                        services.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name} · {(service.finalPrice ?? service.price).toFixed(2)}€ · {service.duration} min
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Barbero</Label>
                  <Select value={selectedBarberId} onValueChange={(value) => {
                    setSelectedBarberId(value);
                    setSelectedDate('');
                    setSelectedTime('');
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un barbero" />
                    </SelectTrigger>
                    <SelectContent>
                      {barbers
                        .filter((barber) => barber.isActive !== false)
                        .map((barber) => (
                          <SelectItem key={barber.id} value={barber.id}>
                            {barber.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date & time */}
              <div className="space-y-3">
                <Label className="text-base">Fecha y hora</Label>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="appointment-date" className="text-sm text-muted-foreground flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      Selecciona el día
                    </Label>
                    <Input
                      id="appointment-date"
                      type="date"
                      min={minDate}
                      value={selectedDate}
                      disabled={!selectedBarberId || !selectedServiceId}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Selecciona la hora
                    </Label>
                    <div className="min-h-[100px] rounded-2xl border border-dashed border-border p-3">
                      {!selectedServiceId || !selectedBarberId || !selectedDate ? (
                        <p className="text-sm text-muted-foreground">
                          Selecciona servicio, barbero y fecha para ver la disponibilidad.
                        </p>
                      ) : slotsLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        </div>
                      ) : availableSlots.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No hay horarios disponibles para ese día.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {slotGroups.morning.length > 0 && (
                            <div>
                              <p className="text-xs uppercase text-muted-foreground mb-2">Mañana</p>
                              <div className="flex flex-wrap gap-2">
                                {slotGroups.morning.map((slot) => (
                                  <button
                                    key={slot}
                                    type="button"
                                    onClick={() => setSelectedTime(slot)}
                                    className={cn(
                                      'px-3 py-1.5 rounded-full border text-sm font-medium transition-all',
                                      selectedTime === slot
                                        ? 'bg-primary text-primary-foreground border-primary shadow-glow'
                                        : 'border-border hover:border-primary/40'
                                    )}
                                  >
                                    {slot}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {slotGroups.afternoon.length > 0 && (
                            <div>
                              <p className="text-xs uppercase text-muted-foreground mb-2">Tarde</p>
                              <div className="flex flex-wrap gap-2">
                                {slotGroups.afternoon.map((slot) => (
                                  <button
                                    key={slot}
                                    type="button"
                                    onClick={() => setSelectedTime(slot)}
                                    className={cn(
                                      'px-3 py-1.5 rounded-full border text-sm font-medium transition-all',
                                      selectedTime === slot
                                        ? 'bg-primary text-primary-foreground border-primary shadow-glow'
                                        : 'border-border hover:border-primary/40'
                                    )}
                                  >
                                    {slot}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateAppointment} disabled={!canCreate}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Crear cita
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuickAppointmentButton;
