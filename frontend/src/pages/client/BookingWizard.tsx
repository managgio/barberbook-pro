import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getServices, getBarbers, getAvailableSlots, createAppointment } from '@/data/api';
import { Service, Barber, BookingState, User } from '@/data/types';
import { 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Scissors,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { format, addDays, startOfDay, isSameDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CardSkeleton } from '@/components/common/Skeleton';
import AlertBanner from '@/components/common/AlertBanner';
import defaultAvatar from '@/assets/img/default-avatar.svg';

const STEPS = ['Servicio', 'Barbero y horario', 'Confirmación'];

interface BookingWizardProps {
  isGuest?: boolean;
}

const BookingWizard: React.FC<BookingWizardProps> = ({ isGuest = false }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(0);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [booking, setBooking] = useState<BookingState>({
    serviceId: null,
    barberId: searchParams.get('barber') || null,
    dateTime: null,
  });
  const [guestInfo, setGuestInfo] = useState({ name: '', email: '', phone: '' });

  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [visibleMonth, setVisibleMonth] = useState<Date>(startOfMonth(new Date()));
  const today = startOfDay(new Date());

  useEffect(() => {
    const fetchData = async () => {
      const [servicesData, barbersData] = await Promise.all([
        getServices(),
        getBarbers(),
      ]);
      setServices(servicesData);
      setBarbers(barbersData);
      setIsLoading(false);

      // If barber was preselected, move to step 1
      if (searchParams.get('barber')) {
        setCurrentStep(0); // Start at service selection
      }
    };
    fetchData();
  }, [searchParams]);

  useEffect(() => {
    if (booking.barberId && currentStep === 1) {
      fetchSlots();
    }
  }, [booking.barberId, selectedDate, currentStep]);

  useEffect(() => {
    if (booking.barberId) {
      const stillActive = barbers.some(
        (barber) => barber.id === booking.barberId && barber.isActive !== false
      );
      if (!stillActive) {
        setBooking((prev) => ({ ...prev, barberId: null, dateTime: null }));
      }
    }
  }, [barbers, booking.barberId]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days: Date[] = [];
    let current = calendarStart;
    while (current <= calendarEnd) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [visibleMonth]);

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
    return { morningSlots: morning, afternoonSlots: afternoon };
  }, [availableSlots]);

  const fetchSlots = async () => {
    if (!booking.barberId) return;
    setIsSlotsLoading(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const slots = await getAvailableSlots(booking.barberId, dateStr);
    setAvailableSlots(slots);
    setIsSlotsLoading(false);
  };

  const handleSelectService = (serviceId: string) => {
    setBooking({
      serviceId,
      barberId: null,
      dateTime: null,
    });
    setSelectedDate(today);
    setVisibleMonth(startOfMonth(today));
    setAvailableSlots([]);
    setCurrentStep(1);
  };

  const handleSelectBarber = (barberId: string) => {
    setBooking((prev) => ({
      ...prev,
      barberId,
      dateTime: null,
    }));
    setSelectedDate(today);
    setVisibleMonth(startOfMonth(today));
    setAvailableSlots([]);
  };

  const getService = () => services.find(s => s.id === booking.serviceId);
  const getBarber = () => barbers.find(b => b.id === booking.barberId);
  const availableBarbers = barbers.filter((barber) => barber.isActive !== false);

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return !!booking.serviceId;
      case 1:
        return !!(booking.barberId && booking.dateTime);
      case 2:
        return isGuest ? guestInfo.name.trim().length > 0 && guestInfo.email.trim().length > 0 : true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConfirm = async () => {
    if (!booking.serviceId || !booking.barberId || !booking.dateTime) return;
    if (!isGuest && !user) return;
    if (isGuest && guestInfo.name.trim().length === 0) {
      toast({
        title: 'Falta tu nombre',
        description: 'Necesitamos un nombre para reservar la cita.',
        variant: 'destructive',
      });
      return;
    }
    if (isGuest && guestInfo.email.trim().length === 0) {
      toast({
        title: 'Falta tu correo',
        description: 'Necesitamos un correo electrónico para reservar la cita.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const guestContact = [guestInfo.email.trim(), guestInfo.phone.trim()]
        .filter(Boolean)
        .join(' · ');

      const userId = isGuest ? `guest-${Date.now()}` : (user as User).id;
      await createAppointment({
        userId,
        serviceId: booking.serviceId,
        barberId: booking.barberId,
        startDateTime: booking.dateTime,
        status: 'confirmed',
        guestName: isGuest ? guestInfo.name.trim() : undefined,
        guestContact: isGuest ? (guestContact || undefined) : undefined,
      });

      setShowSuccess(true);

      setTimeout(() => {
        toast({
          title: '¡Cita reservada!',
          description: isGuest
            ? 'Hemos registrado tu cita. Te contactaremos para confirmar cualquier detalle.'
            : 'Tu cita ha sido confirmada correctamente.',
        });
        if (isGuest) {
          navigate('/');
        } else {
          navigate('/app/appointments');
        }
      }, 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo completar la reserva. Inténtalo de nuevo.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  const selectTimeSlot = (slot: string) => {
    const [hours, minutes] = slot.split(':');
    const dateTime = new Date(selectedDate);
    dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    setBooking((prev) => ({ ...prev, dateTime: dateTime.toISOString() }));
  };

  // Success Animation
  if (showSuccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center animate-scale-in">
          <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">¡Reserva confirmada!</h2>
          <p className="text-muted-foreground">
            {isGuest
              ? 'Para cambios o cancelaciones, contáctanos directamente.'
              : 'Redirigiendo a tus citas...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Reservar cita</h1>
        <p className="text-muted-foreground mt-1">
          {isGuest ? 'Reserva como invitado sin necesidad de crear cuenta.' : 'Completa los pasos para reservar tu cita.'}
        </p>
      </div>

      {/* Alerts */}
      <AlertBanner />

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center">
              <div 
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300',
                  index < currentStep 
                    ? 'bg-primary text-primary-foreground' 
                    : index === currentStep
                    ? 'bg-primary text-primary-foreground shadow-glow'
                    : 'bg-secondary text-muted-foreground'
                )}
              >
                {index < currentStep ? <Check className="w-5 h-5" /> : index + 1}
              </div>
              <span className={cn(
                'text-xs mt-2 hidden sm:block',
                index <= currentStep ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {step}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mx-2',
                index < currentStep ? 'bg-primary' : 'bg-border'
              )} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <Card variant="elevated">
        <CardContent className="p-6">
          {/* Step 0: Select Service */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground mb-4">Elige tu servicio</h2>
              {isLoading ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {services.map((service) => (
                    <Card
                      key={service.id}
                      variant={booking.serviceId === service.id ? 'selected' : 'interactive'}
                      className="cursor-pointer"
                      onClick={() => handleSelectService(service.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Scissors className="w-5 h-5 text-primary" />
                          </div>
                          <span className="text-xl font-bold text-primary">{service.price}€</span>
                        </div>
                        <h3 className="font-semibold text-foreground">{service.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 1: Select Barber & Schedule */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-1">Elige tu barbero y horario</h2>
                <p className="text-sm text-muted-foreground">
                  Primero selecciona un estilista y después escoge el día y la hora que mejor te encaje.
                </p>
              </div>
              <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
                <div className="space-y-4">
                  <p className="text-sm font-medium text-muted-foreground">Selecciona a tu estilista preferido</p>
                  <div className="space-y-3 pr-1 max-h-[420px] overflow-y-auto">
                    {availableBarbers.length > 0 ? (
                      availableBarbers.map((barber) => (
                        <button
                          key={barber.id}
                          onClick={() => handleSelectBarber(barber.id)}
                          className={cn(
                            'w-full rounded-2xl border p-3 flex items-center gap-3 text-left transition-all',
                            booking.barberId === barber.id
                              ? 'border-primary bg-primary/5 shadow-glow'
                              : 'border-border bg-card hover:border-primary/40'
                          )}
                        >
                          <img 
                            src={barber.photo || defaultAvatar} 
                            alt={barber.name}
                            className="w-14 h-14 rounded-xl object-cover"
                          />
                          <div className="flex-1">
                            <p className="font-semibold text-foreground">{barber.name}</p>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">{barber.specialty}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Disponible desde {new Date(barber.startDate).toLocaleDateString()}
                              {barber.endDate && ` · hasta ${new Date(barber.endDate).toLocaleDateString()}`}
                            </p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No hay barberos activos disponibles.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-5 rounded-3xl border border-border bg-muted/5 p-3 sm:p-4">
                  {booking.barberId ? (
                    <>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-muted-foreground">Selecciona el día</p>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setVisibleMonth((prev) => subMonths(prev, 1))}
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="text-sm font-semibold text-foreground capitalize">
                              {format(visibleMonth, "MMMM yyyy", { locale: es })}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setVisibleMonth((prev) => addMonths(prev, 1))}
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-muted-foreground">
                          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
                            <span key={day}>{day}</span>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1.5">
                          {calendarDays.map((date) => {
                            const isSelected = isSameDay(date, selectedDate);
                            const isCurrentMonth = isSameMonth(date, visibleMonth);
                            const isPast = isBefore(date, today);
                            return (
                              <button
                                key={date.toISOString()}
                                disabled={isPast}
                                onClick={() => {
                                  setSelectedDate(startOfDay(date));
                                  setBooking((prev) => ({ ...prev, dateTime: null }));
                                }}
                                className={cn(
                                  'rounded-lg px-0 py-1.5 text-center text-xs transition-all border flex flex-col items-center justify-center min-h-[52px]',
                                  isSelected
                                    ? 'bg-primary text-primary-foreground border-primary shadow-glow'
                                    : isPast
                                    ? 'bg-muted text-muted-foreground border-border/50 cursor-not-allowed opacity-60'
                                    : 'bg-card border-border hover:border-primary/40',
                                  !isCurrentMonth && 'opacity-50'
                                )}
                              >
                                <span className="text-[10px] uppercase">{format(date, 'EEE', { locale: es })}</span>
                                <span className="text-base font-semibold leading-none mt-0.5">{format(date, 'd')}</span>
                                <span className="text-[9px] text-muted-foreground mt-0.5">{format(date, 'MMM', { locale: es })}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-3">Horarios disponibles</p>
                        {isSlotsLoading ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        ) : availableSlots.length > 0 ? (
                          <div className="space-y-4">
                            {slotGroups.morningSlots.length > 0 && (
                              <div>
                                <p className="text-xs uppercase text-muted-foreground mb-2 tracking-wide">Mañana</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                                  {slotGroups.morningSlots.map((slot) => {
                                    const [hours, minutes] = slot.split(':');
                                    const slotDate = new Date(selectedDate);
                                    slotDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                                    const isSelected = booking.dateTime === slotDate.toISOString();
                                    return (
                                      <button
                                        key={slot}
                                        onClick={() => selectTimeSlot(slot)}
                                        className={cn(
                                          'rounded-2xl px-3 py-2 text-sm font-semibold border transition-all',
                                          isSelected
                                            ? 'bg-primary text-primary-foreground border-primary shadow-glow'
                                            : 'bg-card border-border hover:border-primary/40'
                                        )}
                                      >
                                        {slot}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {slotGroups.afternoonSlots.length > 0 && (
                              <div>
                                <p className="text-xs uppercase text-muted-foreground mb-2 tracking-wide">Tarde</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                                  {slotGroups.afternoonSlots.map((slot) => {
                                    const [hours, minutes] = slot.split(':');
                                    const slotDate = new Date(selectedDate);
                                    slotDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                                    const isSelected = booking.dateTime === slotDate.toISOString();
                                    return (
                                      <button
                                        key={slot}
                                        onClick={() => selectTimeSlot(slot)}
                                        className={cn(
                                          'rounded-2xl px-3 py-2 text-sm font-semibold border transition-all',
                                          isSelected
                                            ? 'bg-primary text-primary-foreground border-primary shadow-glow'
                                            : 'bg-card border-border hover:border-primary/40'
                                        )}
                                      >
                                        {slot}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                            No hay horarios disponibles para este día
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-16 gap-3 text-muted-foreground">
                      <Calendar className="w-10 h-10" />
                      <p className="text-sm font-medium">Selecciona primero a un barbero para revisar su agenda.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Confirmation */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Confirma tu reserva</h2>
              
              <div className="bg-secondary/50 rounded-xl p-6 space-y-4">
                {/* Service */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Scissors className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Servicio</p>
                    <p className="font-semibold text-foreground">{getService()?.name}</p>
                  </div>
                  <span className="text-xl font-bold text-primary">{getService()?.price}€</span>
                </div>

                <hr className="border-border" />

                {/* Barber */}
                <div className="flex items-center gap-4">
                  <img 
                    src={getBarber()?.photo || defaultAvatar} 
                    alt={getBarber()?.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <div>
                    <p className="text-sm text-muted-foreground">Barbero</p>
                    <p className="font-semibold text-foreground">{getBarber()?.name}</p>
                  </div>
                </div>

                <hr className="border-border" />

                {/* Date & Time */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha y hora</p>
                    <p className="font-semibold text-foreground">
                      {booking.dateTime && format(new Date(booking.dateTime), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                    </p>
                  </div>
                </div>
                <hr className="border-border" />

                {isGuest && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="guest-name">Tu nombre *</Label>
                        <Input
                          id="guest-name"
                          placeholder="Nombre y apellidos"
                          value={guestInfo.name}
                          onChange={(e) => setGuestInfo((prev) => ({ ...prev, name: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guest-email">Correo *</Label>
                        <Input
                          id="guest-email"
                          type="email"
                          placeholder="nombre@email.com"
                          value={guestInfo.email}
                          onChange={(e) => setGuestInfo((prev) => ({ ...prev, email: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="guest-phone">Teléfono (opcional)</Label>
                      <Input
                        id="guest-phone"
                        type="tel"
                        placeholder="+34 600 000 000"
                        value={guestInfo.phone}
                        onChange={(e) => setGuestInfo((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Para cambios o cancelaciones, contacta directamente con el salón.
                    </p>
                    <hr className="border-border" />
                  </>
                )}

              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        {currentStep > 0 && (
          <Button
            variant="outline"
            onClick={handleBack}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Atrás
          </Button>
        )}

        <div className={currentStep === 0 ? "ml-auto" : ""}>
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Siguiente
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button 
              variant="glow" 
              onClick={handleConfirm} 
              disabled={isSubmitting || (isGuest && (guestInfo.name.trim().length === 0 || guestInfo.email.trim().length === 0))}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar reserva
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingWizard;
