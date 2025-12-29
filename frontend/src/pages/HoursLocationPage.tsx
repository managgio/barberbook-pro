import React, { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MapPin, Phone, Instagram, Mail } from 'lucide-react';
import { SALON_INFO } from '@/data/salonInfo';
import { getShopSchedule } from '@/data/api';
import { ShopSchedule } from '@/data/types';

const dayNames: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

const formatDaySchedule = (schedule: ShopSchedule[keyof ShopSchedule]) => {
  if (schedule.closed) return 'Cerrado';
  const segments: string[] = [];
  if (schedule.morning.enabled) {
    segments.push(`${schedule.morning.start} - ${schedule.morning.end}`);
  }
  if (schedule.afternoon.enabled) {
    segments.push(`${schedule.afternoon.start} - ${schedule.afternoon.end}`);
  }
  return segments.length > 0 ? segments.join(' · ') : 'Cerrado';
};

const HoursLocationPage: React.FC = () => {
  const [schedule, setSchedule] = useState<ShopSchedule | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getShopSchedule();
        setSchedule(data);
      } catch (error) {
        console.error('Error fetching shop schedule', error);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-24 pb-16">
        <div className="container px-4">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Horario y <span className="text-gradient">ubicación</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Visítanos en Sagunto, a minutos de Valencia. Estamos aquí para cuidar de tu imagen.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Schedule */}
            <Card variant="elevated" className="animate-slide-up">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Horario de apertura
                </CardTitle>
              </CardHeader>
              <CardContent>
                {schedule ? (
                  <div className="space-y-3">
                    {Object.entries(schedule).map(([day, daySchedule]) => (
                      <div 
                        key={day}
                        className="flex justify-between items-center py-3 border-b border-border last:border-0"
                      >
                        <span className="font-medium text-foreground">{dayNames[day]}</span>
                        <span className={`${daySchedule.closed ? 'text-muted-foreground' : 'text-primary'}`}>
                          {formatDaySchedule(daySchedule)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Cargando horario...</p>
                )}
              </CardContent>
            </Card>

            {/* Contact & Location */}
            <div className="space-y-6">
              {/* Map */}
              <Card variant="elevated" className="overflow-hidden animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <div className="aspect-video">
                  <iframe
                    src={SALON_INFO.mapEmbedUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Ubicación de Le Blond Hair Salon"
                  />
                </div>
              </Card>

              {/* Contact Info */}
              <Card variant="elevated" className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    Contacto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Dirección</p>
                      <a
                        href={SALON_INFO.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {SALON_INFO.locationLabel}
                      </a>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Teléfono</p>
                      <a href={`tel:${SALON_INFO.phoneHref}`} className="text-primary hover:underline">
                        {SALON_INFO.phoneDisplay}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Correo</p>
                      <a href={`mailto:${SALON_INFO.email}`} className="text-primary hover:underline">
                        {SALON_INFO.email}
                      </a>
                    </div>
                  </div>

                  <hr className="border-border" />

                  <div>
                    <p className="font-medium text-foreground mb-3">Síguenos</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <a 
                        href={SALON_INFO.instagram} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Instagram className="w-5 h-5" />
                        @leblondhairsalon
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HoursLocationPage;
