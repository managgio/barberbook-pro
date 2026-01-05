import React from 'react';
import Navbar from '@/components/layout/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MapPin, Phone, Instagram, Mail, Twitter, Linkedin, Youtube, Music2 } from 'lucide-react';
import { ShopSchedule } from '@/data/types';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { buildSocialUrl, buildWhatsappLink, formatPhoneDisplay } from '@/lib/siteSettings';

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
  const { settings, isLoading } = useSiteSettings();
  const schedule = settings.openingHours;
  const whatsappLink = buildWhatsappLink(settings.contact.phone) || '#';
  const phoneHref = settings.contact.phone
    ? `tel:${settings.contact.phone.replace(/\s+/g, '')}`
    : '#';
  const phoneDisplay = formatPhoneDisplay(settings.contact.phone) || settings.contact.phone;
  const formatHandle = (value?: string) => {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        const path = url.pathname.replace(/^\/+/, '');
        return path ? (path.startsWith('@') ? path : `@${path}`) : url.hostname;
      } catch {
        return value;
      }
    }
    const clean = value.replace(/^@+/, '');
    return clean ? `@${clean}` : '';
  };
  const socials = [
    {
      key: 'instagram',
      label: formatHandle(settings.socials.instagram),
      icon: Instagram,
      url: buildSocialUrl('instagram', settings.socials.instagram),
      handle: settings.socials.instagram,
    },
    { key: 'x', label: formatHandle(settings.socials.x), icon: Twitter, url: buildSocialUrl('x', settings.socials.x), handle: settings.socials.x },
    {
      key: 'tiktok',
      label: formatHandle(settings.socials.tiktok),
      icon: Music2,
      url: buildSocialUrl('tiktok', settings.socials.tiktok),
      handle: settings.socials.tiktok,
    },
    {
      key: 'youtube',
      label: formatHandle(settings.socials.youtube),
      icon: Youtube,
      url: buildSocialUrl('youtube', settings.socials.youtube),
      handle: settings.socials.youtube,
    },
    {
      key: 'linkedin',
      label: formatHandle(settings.socials.linkedin),
      icon: Linkedin,
      url: buildSocialUrl('linkedin', settings.socials.linkedin),
      handle: settings.socials.linkedin,
    },
  ].filter((social) => social.url && social.label);

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
              Visítanos cuando quieras. Estamos aquí para cuidar de tu imagen.
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
                    src={settings.location.mapEmbedUrl || settings.location.mapUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={`Ubicación de ${settings.branding.name}`}
                  />
                </div>
              </Card>

              {/* Contact Info */}
              <Card variant="elevated" className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Contacto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Dirección</p>
                      <a
                        href={settings.location.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {settings.location.label}
                      </a>
                    </div>
                  </div>
                  
                      <div className="flex items-start gap-3">
                        <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium text-foreground">Contacto</p>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                            <a
                              href={phoneHref}
                              className="text-primary hover:underline"
                            >
                              Llamar · {phoneDisplay || settings.contact.phone}
                            </a>
                            <span className="hidden sm:block text-muted-foreground">·</span>
                            <a href={whatsappLink} className="text-primary hover:underline">
                              WhatsApp directo
                            </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Correo</p>
                      <a href={`mailto:${settings.contact.email}`} className="text-primary hover:underline">
                        {settings.contact.email}
                      </a>
                    </div>
                  </div>

                  <hr className="border-border" />

                  <div>
                    <p className="font-medium text-foreground mb-3">Síguenos</p>
                    {socials.length > 0 ? (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {socials.map((social) => (
                          <a 
                            key={social.key}
                            href={social.url}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          >
                            <social.icon className="w-5 h-5" />
                            {social.label}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin redes configuradas.</p>
                    )}
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
