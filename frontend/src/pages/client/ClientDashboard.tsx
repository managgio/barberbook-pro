import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAppointmentsByUser } from '@/data/api/appointments';
import { getBarbers } from '@/data/api/barbers';
import { getLoyaltySummary } from '@/data/api/loyalty';
import { getReferralSummary } from '@/data/api/referrals';
import { getServices } from '@/data/api/services';
import { Appointment, Barber, LoyaltySummary, ReferralSummaryResponse, Service } from '@/data/types';
import AlertBanner from '@/components/common/AlertBanner';
import { Calendar, User, ArrowRight, Scissors, Crown, X } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ListSkeleton } from '@/components/common/Skeleton';
import defaultAvatar from '@/assets/img/default-image.webp';
import { useBusinessCopy } from '@/lib/businessCopy';
import { isAppointmentUpcomingStatus } from '@/lib/appointmentStatus';
import LoyaltyProgressPanel from '@/components/common/LoyaltyProgressPanel';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { getStoredLocalId } from '@/lib/tenant';

const EMPTY_APPOINTMENTS: Appointment[] = [];
const EMPTY_BARBERS: Barber[] = [];
const EMPTY_SERVICES: Service[] = [];

const ClientDashboard: React.FC = () => {
  const { user } = useAuth();
  const copy = useBusinessCopy();
  const [referralBannerDismissed, setReferralBannerDismissed] = useState(false);
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

  const loyaltyQuery = useQuery<LoyaltySummary | null>({
    queryKey: queryKeys.clientLoyaltySummary(localId, userId),
    queryFn: async () => {
      try {
        return await getLoyaltySummary(userId as string);
      } catch {
        return null;
      }
    },
    enabled: Boolean(userId),
  });

  const referralQuery = useQuery<ReferralSummaryResponse | null>({
    queryKey: queryKeys.clientReferralSummary(localId, userId),
    queryFn: async () => {
      try {
        return await getReferralSummary(userId as string);
      } catch {
        return null;
      }
    },
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setReferralBannerDismissed(localStorage.getItem('managgio.referrals.banner.dismissed') === 'true');
  }, []);

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
  const loyaltySummary = loyaltyQuery.data ?? null;
  const referralSummary = referralQuery.data ?? null;
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

  const completedAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status === 'completed'),
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
  const barberSnapshotsById = useMemo(() => {
    const map = new Map<string, string>();
    appointments.forEach((item) => {
      if (!item.barberNameSnapshot) return;
      if (map.has(item.barberId)) return;
      map.set(item.barberId, item.barberNameSnapshot);
    });
    return map;
  }, [appointments]);
  const serviceSnapshotsById = useMemo(() => {
    const map = new Map<string, string>();
    appointments.forEach((item) => {
      if (!item.serviceNameSnapshot) return;
      if (map.has(item.serviceId)) return;
      map.set(item.serviceId, item.serviceNameSnapshot);
    });
    return map;
  }, [appointments]);

  const getMostFrequentId = (items: Appointment[], key: 'serviceId' | 'barberId') => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const id = item[key];
      counts[id] = (counts[id] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : null;
  };

  const favoriteServiceId = getMostFrequentId(completedAppointments, 'serviceId');
  const favoriteBarberId = getMostFrequentId(completedAppointments, 'barberId');
  const favoriteServiceName = favoriteServiceId
    ? servicesById.get(favoriteServiceId)?.name ?? serviceSnapshotsById.get(favoriteServiceId) ?? 'Sin datos'
    : 'Sin datos';
  const favoriteBarberName = favoriteBarberId
    ? barbersById.get(favoriteBarberId)?.name ?? barberSnapshotsById.get(favoriteBarberId) ?? 'Sin datos'
    : 'Sin datos';

  const showReferralBanner =
    completedAppointments.length > 0 &&
    referralSummary?.programEnabled !== false &&
    !referralBannerDismissed;

  const dismissReferralBanner = () => {
    setReferralBannerDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('managgio.referrals.banner.dismissed', 'true');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-foreground">
            ¡Hola, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-xs sm:text-base text-muted-foreground mt-0.5 sm:mt-1">
            Gestiona tus citas y mantén tu estilo impecable.
          </p>
        </div>
        <Button variant="glow" size="lg" className="h-8 sm:h-11 px-3 sm:px-5 text-xs sm:text-base" asChild>
          <Link to="/app/book">
            <Calendar className="w-3.5 h-3.5 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
            Reservar ahora
          </Link>
        </Button>
      </div>

      {/* Alerts */}
      <AlertBanner />

      {showReferralBanner && (
        <div className="relative rounded-2xl border border-primary/20 bg-primary/5 px-3 sm:px-4 py-2.5 sm:py-3 pr-10 sm:pr-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div>
            <p className="text-xs sm:text-sm font-semibold text-foreground">¿Conoces a alguien? Invítalo y gana.</p>
            <p className="hidden sm:block text-xs text-muted-foreground">Comparte tu enlace y desbloquea recompensas.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="glow" size="sm" className="h-8 text-xs sm:text-sm" asChild>
              <Link to="/app/referrals">Invita y gana</Link>
            </Button>
          </div>
          <button
            type="button"
            onClick={dismissReferralBanner}
            className="absolute top-2 right-2 sm:top-3 sm:right-3 p-0.5 sm:p-1 rounded-full hover:bg-primary/10 text-muted-foreground"
            aria-label="Cerrar"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        {[
          { label: 'Próximas citas', value: upcomingAppointments.length, icon: Calendar },
          { label: 'Total de visitas', value: completedAppointments.length, icon: User },
          { label: 'Corte más solicitado por ti', value: favoriteServiceName, icon: Scissors },
          { label: `${copy.staff.singular} más visitado`, value: favoriteBarberName, icon: Crown },
        ].map((stat, index) => (
          <Card key={stat.label} variant="glass" className="animate-scale-in" style={{ animationDelay: `${index * 0.1}s` }}>
            <CardContent className="p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm sm:text-2xl font-bold text-foreground truncate">{stat.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loyaltySummary?.enabled && loyaltySummary.programs.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base sm:text-xl font-semibold text-foreground">Fidelización</h2>
            <Link to="/app/profile#loyalty" className="text-xs sm:text-sm text-primary hover:underline">
              Ver detalle
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {loyaltySummary.programs.map(({ program, progress }) => (
              <Card key={program.id} variant="glass">
                <CardContent className="p-4">
                  <LoyaltyProgressPanel program={program} progress={progress} variant="compact" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Appointments */}
      <Card variant="elevated">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base sm:text-lg">Próximas citas</CardTitle>
          <Link to="/app/appointments" className="text-xs sm:text-sm text-primary hover:underline flex items-center">
            Ver todas
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1" />
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ListSkeleton count={2} />
          ) : upcomingAppointments.length > 0 ? (
            <div className="space-y-2.5 sm:space-y-4">
              {upcomingAppointments.slice(0, 3).map((appointment) => {
                const barber = barbersById.get(appointment.barberId);
                const service = servicesById.get(appointment.serviceId);
                const barberName = barber?.name ?? appointment.barberNameSnapshot ?? `${copy.staff.singular} eliminado`;
                const serviceName = service?.name ?? appointment.serviceNameSnapshot ?? 'Servicio eliminado';
                const date = parseISO(appointment.startDateTime);
                
                return (
                  <div 
                    key={appointment.id}
                    className="flex items-center gap-2.5 sm:gap-4 p-2.5 sm:p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <img 
                      src={barber?.photo || defaultAvatar} 
                      alt={barberName}
                      loading="lazy"
                      decoding="async"
                      width={48}
                      height={48}
                      className="w-9 h-9 sm:w-12 sm:h-12 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-medium text-foreground truncate">{serviceName}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">con {barberName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs sm:text-sm font-medium text-primary">
                        {format(date, 'EEEE d', { locale: es })}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {format(date, 'HH:mm')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
              </div>
              <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">No tienes citas programadas</p>
              <Button className="h-8 sm:h-10 text-xs sm:text-sm" asChild>
                <Link to="/app/book">Reservar mi primera cita</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default ClientDashboard;
