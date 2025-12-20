import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAppointments, getBarbers, getServices } from '@/data/api';
import { Appointment, Barber, Service } from '@/data/types';
import { 
  Calendar, 
  Users, 
  Scissors, 
  TrendingUp,
  ArrowRight,
  Clock,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { format, isToday, parseISO, startOfWeek, endOfWeek, isWithinInterval, subDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ListSkeleton } from '@/components/common/Skeleton';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

const rangeOptions = [
  { label: '7 días', value: 7 },
  { label: '14 días', value: 14 },
  { label: '30 días', value: 30 },
];

const AdminDashboard: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revenueRange, setRevenueRange] = useState(7);

  useEffect(() => {
    const fetchData = async () => {
      const [appts, barbersData, servicesData] = await Promise.all([
        getAppointments(),
        getBarbers(),
        getServices(),
      ]);
      setAppointments(appts);
      setBarbers(barbersData);
      setServices(servicesData);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const todayAppointments = appointments.filter(a => 
    isToday(parseISO(a.startDateTime)) && a.status === 'confirmed'
  );

  const weekStart = startOfWeek(new Date(), { locale: es });
  const weekEnd = endOfWeek(new Date(), { locale: es });
  const weekAppointments = appointments.filter(a => 
    isWithinInterval(parseISO(a.startDateTime), { start: weekStart, end: weekEnd }) &&
    a.status !== 'cancelled'
  );

  const getBarber = (id: string) => barbers.find(b => b.id === id);
  const getService = (id: string) => services.find(s => s.id === id);

  const revenueToday = todayAppointments.reduce((total, appointment) => {
    const service = getService(appointment.serviceId);
    return total + (service?.price || 0);
  }, 0);

  const weekCancelled = appointments.filter(a => 
    a.status === 'cancelled' &&
    isWithinInterval(parseISO(a.startDateTime), { start: weekStart, end: weekEnd })
  ).length;

  const currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });

  const selectedDays = Array.from({ length: revenueRange }).map((_, index) =>
    subDays(new Date(), revenueRange - 1 - index)
  );
  const revenueData = selectedDays.map((day) => {
    const dayAppointments = appointments.filter((appointment) => 
      appointment.status !== 'cancelled' && isSameDay(parseISO(appointment.startDateTime), day)
    );
    const total = dayAppointments.reduce((sum, appointment) => {
      const service = getService(appointment.serviceId);
      return sum + (service?.price || 0);
    }, 0);
    return {
      label: format(day, 'dd MMM', { locale: es }),
      value: total,
    };
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Resumen de la actividad de la barbería.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { 
            label: 'Citas hoy', 
            value: todayAppointments.length, 
            icon: Calendar,
            color: 'text-primary',
          },
          { 
            label: 'Citas esta semana', 
            value: weekAppointments.length, 
            icon: TrendingUp,
            color: 'text-green-500',
          },
          { 
            label: 'Ingresos hoy', 
            value: currencyFormatter.format(revenueToday), 
            icon: DollarSign,
            color: 'text-amber-500',
          },
          { 
            label: 'Cancelaciones semana', 
            value: weekCancelled, 
            icon: AlertTriangle,
            color: 'text-rose-500',
          },
        ].map((stat, index) => (
          <Card key={stat.label} variant="elevated" className="animate-scale-in" style={{ animationDelay: `${index * 0.1}s` }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-secondary flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Citas de hoy</CardTitle>
            <Link to="/admin/calendar" className="text-sm text-primary hover:underline flex items-center">
              Ver calendario
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ListSkeleton count={3} />
            ) : todayAppointments.length > 0 ? (
              <div className="space-y-3">
                {todayAppointments.map((appointment) => {
                  const barber = getBarber(appointment.barberId);
                  const service = getService(appointment.serviceId);
                  const time = format(parseISO(appointment.startDateTime), 'HH:mm');
                  
                  return (
                    <div 
                      key={appointment.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{service?.name}</p>
                        <p className="text-sm text-muted-foreground">con {barber?.name}</p>
                      </div>
                      <span className="text-lg font-semibold text-primary">{time}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No hay citas programadas para hoy
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue chart */}
        <Card variant="elevated">
          <CardHeader className="flex flex-col gap-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Ingresos últimos {revenueRange} días</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Seguimiento diario de ingresos estimados según citas confirmadas.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {rangeOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={option.value === revenueRange ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRevenueRange(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(value) => (value >= 1000 ? `${Math.round(value / 100) / 10}k` : value)}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '4 4' }}
                  contentStyle={{ background: 'hsl(var(--card))', borderRadius: '12px', border: 'none' }}
                  formatter={(value: number) => [currencyFormatter.format(value), 'Ingresos']}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ r: 4, fill: 'hsl(var(--foreground))', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  fillOpacity={1}
                  fill="url(#revenueGradient)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
