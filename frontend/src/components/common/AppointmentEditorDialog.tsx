import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { getAdminProducts, getProducts, getProductCategories, getServices, getBarbers, getAvailableSlots, updateAppointment, getServiceCategories, getSiteSettings, anonymizeAppointment } from '@/data/api';
import { Appointment, AppointmentStatus, Barber, Product, ProductCategory, Service, ServiceCategory } from '@/data/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { dispatchAppointmentsUpdated } from '@/lib/adminEvents';
import ProductSelector from '@/components/common/ProductSelector';

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
  const [products, setProducts] = useState<Product[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [categoriesEnabled, setCategoriesEnabled] = useState(false);
  const [productsEnabled, setProductsEnabled] = useState(false);
  const [clientPurchaseEnabled, setClientPurchaseEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnonymizing, setIsAnonymizing] = useState(false);
  const [anonymizeOpen, setAnonymizeOpen] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Array<{ productId: string; quantity: number }>>([]);
  const [isProductsDialogOpen, setIsProductsDialogOpen] = useState(false);
  const isAdminContext = context === 'admin';
  const isNoShowLocked = appointment?.status === 'no_show' || appointment?.status === 'cancelled';

  const [form, setForm] = useState({
    serviceId: '',
    barberId: '',
    date: '',
    time: '',
    notes: '',
    status: 'scheduled' as AppointmentStatus,
  });

  const loadInitialData = async () => {
    if (!appointment) return;
    setIsLoading(true);
    try {
      const [servicesData, barbersData, categoriesData, settingsData, productsData, productCategoriesData] = await Promise.all([
        getServices({ includeArchived: isAdminContext }),
        getBarbers(),
        getServiceCategories(true),
        getSiteSettings(),
        isAdminContext ? getAdminProducts() : getProducts('booking'),
        getProductCategories(true),
      ]);
      setServices(servicesData);
      setBarbers(barbersData);
      setServiceCategories(categoriesData);
      setCategoriesEnabled(settingsData.services.categoriesEnabled);
      setProductsEnabled(settingsData.products.enabled);
      setClientPurchaseEnabled(settingsData.products.clientPurchaseEnabled);
      setProducts(productsData);
      setProductCategories(productCategoriesData);
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
        status: appointment.status,
      });
      setSelectedProducts(
        appointment.products?.map((item) => ({ productId: item.productId, quantity: item.quantity })) ?? [],
      );
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

  const loadSlots = async (
    barberId: string,
    date: string,
    serviceId?: string,
    options?: { silent?: boolean },
  ): Promise<string[]> => {
    if (!barberId || !date || !serviceId) {
      setAvailableSlots([]);
      return [];
    }
    setSlotsLoading(true);
    try {
      const slots = await getAvailableSlots(barberId, date, {
        serviceId,
        appointmentIdToIgnore: appointment?.id,
      });
      setAvailableSlots(slots);
      return slots;
    } catch (error) {
      if (!options?.silent) {
        toast({ title: 'Error', description: 'No se pudo cargar la disponibilidad.', variant: 'destructive' });
      }
      setAvailableSlots([]);
      return [];
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

  const selectableServices = useMemo(
    () => services.filter((service) => !service.isArchived || service.id === form.serviceId),
    [services, form.serviceId],
  );

  const selectedProductsTotal = useMemo(() => {
    return selectedProducts.reduce((acc, item) => {
      const product = products.find((prod) => prod.id === item.productId);
      if (!product) return acc;
      const unitPrice = product.finalPrice ?? product.price;
      return acc + unitPrice * item.quantity;
    }, 0);
  }, [products, selectedProducts]);
  const selectedProductDetails = useMemo(() => {
    return selectedProducts
      .map((item) => {
        const product = products.find((prod) => prod.id === item.productId);
        if (!product) return null;
        const unitPrice = product.finalPrice ?? product.price;
        return {
          id: product.id,
          name: product.name,
          quantity: item.quantity,
          unitPrice,
          total: unitPrice * item.quantity,
          imageUrl: product.imageUrl ?? null,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      name: string;
      quantity: number;
      unitPrice: number;
      total: number;
      imageUrl: string | null;
    }>;
  }, [products, selectedProducts]);

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

  const uncategorizedServices = useMemo(
    () => selectableServices.filter((service) => !service.categoryId),
    [selectableServices],
  );
  const servicesByCategory = useMemo(
    () => orderedCategories.reduce<Record<string, Service[]>>((acc, cat) => {
      acc[cat.id] = selectableServices.filter((service) => service.categoryId === cat.id);
      return acc;
    }, {}),
    [orderedCategories, selectableServices],
  );

  const canShowProducts = productsEnabled && (isAdminContext || clientPurchaseEnabled);

  const handleServiceChange = (value: string) => {
    setForm((prev) => ({ ...prev, serviceId: value, time: '' }));
  };

  const handleSave = async () => {
    if (!appointment) return;
    if (!form.serviceId || !form.barberId || !form.date || !form.time) {
      toast({ title: 'Campos incompletos', description: 'Selecciona servicio, barbero, fecha y hora.' });
      return;
    }
    setIsSaving(true);
    try {
      const dateTime = new Date(`${form.date}T${form.time}:00`).toISOString();
      const productsPayload = canShowProducts ? selectedProducts : undefined;
      const updated = await updateAppointment(appointment.id, {
        serviceId: form.serviceId,
        barberId: form.barberId,
        startDateTime: dateTime,
        ...(isAdminContext ? {} : { notes: form.notes.trim() }),
        ...(isAdminContext ? { status: form.status } : {}),
        ...(productsPayload ? { products: productsPayload } : {}),
      });
      if (context === 'admin') {
        dispatchAppointmentsUpdated({ source: 'appointment-editor' });
      }
      toast({ title: 'Cita actualizada', description: 'Los cambios han sido guardados.' });
      onSaved?.(updated);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const isSlotConflict = message.toLowerCase().includes('horario no disponible');
      if (isSlotConflict) {
        toast({
          title: 'Horario ocupado',
          description: 'Ese horario se acaba de reservar. Hemos actualizado la disponibilidad.',
          variant: 'destructive',
        });
        const slots = await loadSlots(form.barberId, form.date, form.serviceId, { silent: true });
        if (slots.length === 0 || !slots.includes(form.time)) {
          setForm((prev) => ({ ...prev, time: '' }));
        }
      } else {
        toast({ title: 'Error', description: 'No se pudo actualizar la cita.', variant: 'destructive' });
      }
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar cita</DialogTitle>
          <DialogDescription>
            Actualiza el servicio, barbero o horario de esta cita.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
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
                      selectableServices.map((service) => (
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

            {productsEnabled && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Label>Productos para la cita</Label>
                    <p className="text-xs text-muted-foreground">
                      Solo se muestran los productos añadidos en esta cita.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      Total productos: {selectedProductsTotal.toFixed(2)}€
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsProductsDialogOpen(true)}
                      disabled={!canShowProducts || isNoShowLocked}
                    >
                      {selectedProducts.length > 0 ? 'Editar productos' : 'Añadir productos'}
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3">
                  {selectedProductDetails.length > 0 ? (
                    <div className="space-y-3">
                      {selectedProductDetails.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-muted/60 overflow-hidden flex items-center justify-center">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-[11px] text-muted-foreground">Sin foto</span>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{item.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.quantity} x {item.unitPrice.toFixed(2)}€
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-foreground">{item.total.toFixed(2)}€</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin productos añadidos.</p>
                  )}
                </div>
                {!canShowProducts && (
                  <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    La compra de productos no está disponible para clientes en este local.
                  </div>
                )}
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
        </div>
      </DialogContent>
      <Dialog open={isProductsDialogOpen} onOpenChange={setIsProductsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Seleccionar productos</DialogTitle>
            <DialogDescription>
              Busca y añade productos a la cita. Solo se guardarán los seleccionados.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <ProductSelector
              products={products}
              categories={productCategories}
              selected={selectedProducts}
              onChange={setSelectedProducts}
              disabled={isNoShowLocked}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setIsProductsDialogOpen(false)}>
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default AppointmentEditorDialog;
