import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAppointmentsByUser, getBarbers, getServices } from '@/data/api';
import { Appointment, Barber, Service } from '@/data/types';
import AlertBanner from '@/components/common/AlertBanner';
import { Calendar, User, ArrowRight, Scissors, Crown } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ListSkeleton } from '@/components/common/Skeleton';
import defaultAvatar from '@/assets/img/default-avatar.svg';
import { isAppointmentUpcomingStatus } from '@/lib/appointmentStatus';

const ClientDashboard: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      const [appts, barbersData, servicesData] = await Promise.all([
        getAppointmentsByUser(user.id),
        getBarbers(),
        getServices(),
      ]);
      
      setAppointments(appts);
      setBarbers(barbersData);
      setServices(servicesData);
      setIsLoading(false);
    };
    
    fetchData();
  }, [user]);

  const upcomingAppointments = appointments
    .filter(
      (appointment) =>
        !isPast(parseISO(appointment.startDateTime)) && isAppointmentUpcomingStatus(appointment.status),
    )
    .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());

  const completedAppointments = appointments.filter(a => a.status === 'completed');

  const getBarber = (id: string) => barbers.find(b => b.id === id);
  const getService = (id: string) => services.find(s => s.id === id);
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
  const favoriteServiceName = favoriteServiceId ? getService(favoriteServiceId)?.name ?? 'Sin datos' : 'Sin datos';
  const favoriteBarberName = favoriteBarberId ? getBarber(favoriteBarberId)?.name ?? 'Sin datos' : 'Sin datos';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            ¡Hola, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus citas y mantén tu estilo impecable.
          </p>
        </div>
        <Button variant="glow" size="lg" asChild>
          <Link to="/app/book">
            <Calendar className="w-5 h-5 mr-2" />
            Reservar ahora
          </Link>
        </Button>
      </div>

      {/* Alerts */}
      <AlertBanner />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Próximas citas', value: upcomingAppointments.length, icon: Calendar },
          { label: 'Total de visitas', value: completedAppointments.length, icon: User },
          { label: 'Corte más solicitado por ti', value: favoriteServiceName, icon: Scissors },
          { label: 'Barbero más visitado', value: favoriteBarberName, icon: Crown },
        ].map((stat, index) => (
          <Card key={stat.label} variant="glass" className="animate-scale-in" style={{ animationDelay: `${index * 0.1}s` }}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upcoming Appointments */}
      <Card variant="elevated">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Próximas citas</CardTitle>
          <Link to="/app/appointments" className="text-sm text-primary hover:underline flex items-center">
            Ver todas
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ListSkeleton count={2} />
          ) : upcomingAppointments.length > 0 ? (
            <div className="space-y-4">
              {upcomingAppointments.slice(0, 3).map((appointment) => {
                const barber = getBarber(appointment.barberId);
                const service = getService(appointment.serviceId);
                const date = parseISO(appointment.startDateTime);
                
                return (
                  <div 
                    key={appointment.id}
                    className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <img 
                      src={barber?.photo || defaultAvatar} 
                      alt={barber?.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{service?.name}</p>
                      <p className="text-sm text-muted-foreground">con {barber?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-primary">
                        {format(date, 'EEEE d', { locale: es })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(date, 'HH:mm')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">No tienes citas programadas</p>
              <Button asChild>
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
