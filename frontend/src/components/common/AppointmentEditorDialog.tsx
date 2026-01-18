import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { getServices, getBarbers, getAvailableSlots, updateAppointment, getServiceCategories, getSiteSettings, anonymizeAppointment } from '@/data/api';
import { Appointment, AppointmentStatus, Barber, PaymentMethod, Service, ServiceCategory } from '@/data/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { dispatchAppointmentsUpdated } from '@/lib/adminEvents';

interface AppointmentEditorDialogProps {
  open: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onSaved?: (appointment: Appointment) => void;
  context?: 'admin' | 'client';
}

const AppointmentEditorDialog: React.FC<AppointmentEditorDialogProps> = ({
  open,
  appointment,
  onClose,
  onSaved,
  context = 'admin',
}) => {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [categoriesEnabled, setCategoriesEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnonymizing, setIsAnonymizing] = useState(false);
  const [anonymizeOpen, setAnonymizeOpen] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [priceTouched, setPriceTouched] = useState(false);
  const isAdminContext = context === 'admin';
  const isNoShowLocked = appointment?.status === 'no_show' || appointment?.status === 'cancelled';

  const [form, setForm] = useState({
    serviceId: '',
    barberId: '',
    date: '',
    time: '',
    notes: '',
    price: '',
    paymentMethod: '' as '' | PaymentMethod,
    status: 'scheduled' as AppointmentStatus,
  });

  const loadInitialData = async () => {
    if (!appointment) return;
    setIsLoading(true);
    try {
      const [servicesData, barbersData, categoriesData, settingsData] = await Promise.all([
        getServices(),
        getBarbers(),
        getServiceCategories(true),
        getSiteSettings(),
      ]);
      setServices(servicesData);
      setBarbers(barbersData);
      setServiceCategories(categoriesData);
      setCategoriesEnabled(settingsData.services.categoriesEnabled);
      const initialDate = appointment.startDateTime.split('T')[0];
      const dateObj = new Date(appointment.startDateTime);
      const initialTime = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
      setForm({
        serviceId: appointment.serviceId,
        barberId: appointment.barberId,
        date: initialDate,
        time: initialTime,
        notes: appointment.notes || '',
        price: appointment.price.toFixed(2),
        paymentMethod: appointment.paymentMethod || '',
        status: appointment.status,
      });
      setPriceTouched(false);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo cargar la información.', variant: 'destructive' });
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadInitialData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointment?.id]);

  const loadSlots = async (barberId: string, date: string, serviceId?: string) => {
    if (!barberId || !date || !serviceId) {
      setAvailableSlots([]);
      return;
    }
    setSlotsLoading(true);
    try {
      const slots = await getAvailableSlots(barberId, date, {
        serviceId,
        appointmentIdToIgnore: appointment?.id,
      });
      setAvailableSlots(slots);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo cargar la disponibilidad.', variant: 'destructive' });
      setAvailableSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    if (form.barberId && form.date && form.serviceId) {
      loadSlots(form.barberId, form.date, form.serviceId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.barberId, form.date, form.serviceId]);

  const slotGroups = useMemo(() => {
    const morning: string[] = [];
    const afternoon: string[] = [];
    availableSlots.forEach((slot) => {
      const hour = parseInt(slot.split(':')[0], 10);
      if (hour < 14) morning.push(slot);
      else afternoon.push(slot);
    });
    return { morning, afternoon };
  }, [availableSlots]);

  const filteredBarbers = useMemo(() => {
    if (context === 'admin') return barbers;
    return barbers.filter((barber) => barber.isActive !== false);
  }, [barbers, context]);

  const orderedCategories = useMemo(
    () =>
      [...serviceCategories].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name),
      ),
    [serviceCategories],
  );

  const uncategorizedServices = useMemo(() => services.filter((service) => !service.categoryId), [services]);
  const servicesByCategory = useMemo(
    () => orderedCategories.reduce<Record<string, Service[]>>((acc, cat) => {
      acc[cat.id] = services.filter((service) => service.categoryId === cat.id);
      return acc;
    }, {}),
    [orderedCategories, services],
  );

  const handleServiceChange = (value: string) => {
    setForm((prev) => {
      const nextForm = { ...prev, serviceId: value, time: '' };
      if (!priceTouched) {
        const nextService = services.find((service) => service.id === value);
        const nextPrice = nextService?.finalPrice ?? nextService?.price;
        if (nextPrice !== undefined) {
          nextForm.price = nextPrice.toFixed(2);
        }
      }
      return nextForm;
    });
  };

  const handleSave = async () => {
    if (!appointment) return;
    if (!form.serviceId || !form.barberId || !form.date || !form.time) {
      toast({ title: 'Campos incompletos', description: 'Selecciona servicio, barbero, fecha y hora.' });
      return;
    }
    let priceValue: number | null = null;
    if (isAdminContext) {
      const normalizedPrice = form.price.trim().replace(',', '.');
      const parsedPrice = Number(normalizedPrice);
      if (!normalizedPrice || Number.isNaN(parsedPrice) || parsedPrice < 0) {
        toast({ title: 'Precio inválido', description: 'Introduce un importe válido para la cita.' });
        return;
      }
      priceValue = parsedPrice;
    }
    setIsSaving(true);
    try {
      const dateTime = new Date(`${form.date}T${form.time}:00`).toISOString();
      const updated = await updateAppointment(appointment.id, {
        serviceId: form.serviceId,
        barberId: form.barberId,
        startDateTime: dateTime,
        ...(isAdminContext ? {} : { notes: form.notes.trim() }),
        ...(isAdminContext
          ? {
              status: form.status,
              price: priceValue ?? undefined,
              paymentMethod: form.paymentMethod || null,
            }
          : {}),
      });
      if (context === 'admin') {
        dispatchAppointmentsUpdated({ source: 'appointment-editor' });
      }
      toast({ title: 'Cita actualizada', description: 'Los cambios han sido guardados.' });
      onSaved?.(updated);
      onClose();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar la cita.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnonymize = async () => {
    if (!appointment) return;
    setIsAnonymizing(true);
    try {
      const updated = await anonymizeAppointment(appointment.id);
      if (context === 'admin') {
        dispatchAppointmentsUpdated({ source: 'appointment-anonymize' });
      }
      toast({ title: 'Cita anonimizada', description: 'Los datos personales han sido anonimizados.' });
      onSaved?.(updated);
      setAnonymizeOpen(false);
      onClose();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo anonimizar la cita.', variant: 'destructive' });
    } finally {
      setIsAnonymizing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !isSaving && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar cita</DialogTitle>
          <DialogDescription>
            Actualiza el servicio, barbero o horario de esta cita.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !appointment ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Servicio</Label>
                <Select
                  value={form.serviceId}
                  onValueChange={handleServiceChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriesEnabled && orderedCategories.length > 0 ? (
                      <>
                        {orderedCategories.map((category, index) => {
                          const servicesForCategory = servicesByCategory[category.id] || [];
                          if (servicesForCategory.length === 0) return null;
                          const shouldShowSeparator =
                            index < orderedCategories.length - 1 || uncategorizedServices.length > 0;
                          return (
                            <React.Fragment key={category.id}>
                              <SelectGroup>
                                <SelectLabel>{category.name}</SelectLabel>
                                {servicesForCategory.map((service) => (
                                  <SelectItem key={service.id} value={service.id}>
                                    {service.name} · {(service.finalPrice ?? service.price).toFixed(2)}€ · {service.duration} min
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                              {shouldShowSeparator && <SelectSeparator />}
                            </React.Fragment>
                          );
                        })}
                        {uncategorizedServices.length > 0 && (
                          <React.Fragment key="uncategorized">
                            <SelectGroup>
                              <SelectLabel>Otros</SelectLabel>
                              {uncategorizedServices.map((service) => (
                                <SelectItem key={service.id} value={service.id}>
                                  {service.name} · {(service.finalPrice ?? service.price).toFixed(2)}€ · {service.duration} min
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </React.Fragment>
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
                <Select value={form.barberId} onValueChange={(value) => setForm((prev) => ({ ...prev, barberId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un barbero" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredBarbers.map((barber) => (
                      <SelectItem key={barber.id} value={barber.id}>
                        {barber.name}
                        {barber.isActive === false && ' · (inactivo)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarIcon className="w-4 h-4" /> Selecciona el día
                </Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" /> Selecciona la hora
                </Label>
                <div className="min-h-[120px] rounded-2xl border border-dashed border-border p-3">
                  {!form.serviceId || !form.barberId || !form.date ? (
                    <p className="text-sm text-muted-foreground">
                      Selecciona servicio, barbero y fecha.
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
                                onClick={() => setForm((prev) => ({ ...prev, time: slot }))}
                                className={cn(
                                  'px-3 py-1.5 rounded-full border text-sm font-medium transition-all',
                                  form.time === slot
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
                                onClick={() => setForm((prev) => ({ ...prev, time: slot }))}
                                className={cn(
                                  'px-3 py-1.5 rounded-full border text-sm font-medium transition-all',
                                  form.time === slot
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

            {isAdminContext && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Precio final</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => {
                      setPriceTouched(true);
                      setForm((prev) => ({ ...prev, price: e.target.value }));
                    }}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este importe es el que se usa en caja registradora.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Método de pago</Label>
                  <Select
                    value={form.paymentMethod || 'none'}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        paymentMethod: value === 'none' ? '' : (value as PaymentMethod),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Efectivo</SelectItem>
                      <SelectItem value="card">Tarjeta</SelectItem>
                      <SelectItem value="bizum">Bizum</SelectItem>
                      <SelectItem value="none">Sin método</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {isAdminContext ? (
              appointment.notes?.trim() ? (
                <div className="space-y-2">
                  <Label htmlFor="appointment-notes">Comentario del cliente</Label>
                  <Textarea
                    id="appointment-notes"
                    value={appointment.notes}
                    readOnly
                    className="min-h-[110px] resize-none bg-muted/40"
                  />
                </div>
              ) : null
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="appointment-notes">Comentario del cliente</Label>
                  <span className="text-xs text-muted-foreground">
                    {form.notes.length}/250
                  </span>
                </div>
                <Textarea
                  id="appointment-notes"
                  value={form.notes}
                  maxLength={250}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Añade o edita el comentario del cliente"
                  className="min-h-[110px] resize-none"
                />
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {isAdminContext && (
                <AlertDialog open={anonymizeOpen} onOpenChange={setAnonymizeOpen}>
                  <Button
                    variant="outline"
                    type="button"
                    disabled={isSaving || isAnonymizing}
                    onClick={() => setAnonymizeOpen(true)}
                  >
                    Anonimizar
                  </Button>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Anonimizar cita?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción sustituye los datos personales del invitado por valores anonimizados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleAnonymize} disabled={isAnonymizing}>
                        {isAnonymizing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Confirmar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button variant="outline" type="button" onClick={onClose} disabled={isSaving || isAnonymizing}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving || isAnonymizing}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Guardar cambios
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentEditorDialog;
