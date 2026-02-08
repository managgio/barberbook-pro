import React from 'react';
import Navbar from '@/components/layout/Navbar';
import LegalFooter from '@/components/layout/LegalFooter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MapPin, Phone, Instagram, Mail, Twitter, Linkedin, Youtube, Music2 } from 'lucide-react';
import { DayKey, DaySchedule, ShopSchedule } from '@/data/types';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { buildSocialUrl, buildWhatsappLink, formatPhoneDisplay, normalizePhoneParts } from '@/lib/siteSettings';

const dayNames: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

const dayOrder: DayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const normalizeDaySchedule = (schedule?: Partial<DaySchedule> | null): DaySchedule => ({
  closed: schedule?.closed ?? true,
  morning: {
    enabled: schedule?.morning?.enabled ?? false,
    start: schedule?.morning?.start ?? '',
    end: schedule?.morning?.end ?? '',
  },
  afternoon: {
    enabled: schedule?.afternoon?.enabled ?? false,
    start: schedule?.afternoon?.start ?? '',
    end: schedule?.afternoon?.end ?? '',
  },
});

const formatDaySchedule = (schedule?: Partial<DaySchedule> | null) => {
  const safeSchedule = normalizeDaySchedule(schedule);
  if (safeSchedule.closed) return 'Cerrado';
  const segments: string[] = [];
  if (safeSchedule.morning.enabled && safeSchedule.morning.start && safeSchedule.morning.end) {
    segments.push(`${safeSchedule.morning.start} - ${safeSchedule.morning.end}`);
  }
  if (safeSchedule.afternoon.enabled && safeSchedule.afternoon.start && safeSchedule.afternoon.end) {
    segments.push(`${safeSchedule.afternoon.start} - ${safeSchedule.afternoon.end}`);
  }
  return segments.length > 0 ? segments.join(' · ') : 'Cerrado';
};

const HoursLocationPage: React.FC = () => {
  const { settings, isLoading } = useSiteSettings();
  const schedule = settings.openingHours;
  const contactPhone = settings.contact.phone?.trim() || '';
  const contactEmail = settings.contact.email?.trim() || '';
  const contactPhoneParts = normalizePhoneParts(contactPhone);
  const hasContactPhone = Boolean(contactPhoneParts.number);
  const hasContactEmail = Boolean(contactEmail);
  const whatsappLink = buildWhatsappLink(contactPhone);
  const phoneHref = hasContactPhone ? `tel:${contactPhone.replace(/\s+/g, '')}` : '#';
  const phoneDisplay = formatPhoneDisplay(contactPhone) || contactPhone;
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
  const hasSocials = socials.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-20 pb-10 sm:pt-24 sm:pb-16">
        <div className="container px-4">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-16">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground mb-2 sm:mb-4">
              Horario y <span className="text-gradient">ubicación</span>
            </h1>
            <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Visítanos cuando quieras. Estamos aquí para cuidar de tu imagen.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 sm:gap-8 max-w-6xl mx-auto">
            {/* Schedule */}
            <Card variant="elevated" className="animate-slide-up">
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Horario de apertura
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {schedule ? (
                  <div className="space-y-1.5 sm:space-y-3">
                    {dayOrder.map((day) => {
                      const daySchedule = normalizeDaySchedule(schedule[day]);
                      return (
                      <div 
                        key={day}
                        className="flex justify-between items-center py-2 sm:py-3 border-b border-border last:border-0"
                      >
                        <span className="text-sm sm:text-base font-medium text-foreground">{dayNames[day]}</span>
                        <span className={`text-xs sm:text-sm ${daySchedule.closed ? 'text-muted-foreground' : 'text-primary'}`}>
                          {formatDaySchedule(daySchedule)}
                        </span>
                      </div>
                    )})}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Cargando horario...</p>
                )}
              </CardContent>
            </Card>

            {/* Contact & Location */}
            <div className="space-y-4 sm:space-y-6">
              {/* Map */}
              <Card variant="elevated" className="overflow-hidden animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <div className="aspect-[4/3] sm:aspect-video">
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
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
                    Contacto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 pt-0">
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm sm:text-base font-medium text-foreground">Dirección</p>
                      <a
                        href={settings.location.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm sm:text-base text-primary hover:underline"
                      >
                        {settings.location.label}
                      </a>
                    </div>
                  </div>
                  
                  {hasContactPhone && (
                    <div className="flex items-start gap-2.5 sm:gap-3">
                      <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm sm:text-base font-medium text-foreground">Contacto</p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                          <a
                            href={phoneHref}
                            className="text-sm sm:text-base text-primary hover:underline"
                          >
                            Llamar · {phoneDisplay}
                          </a>
                          {whatsappLink && (
                            <>
                              <span className="hidden sm:block text-muted-foreground">·</span>
                              <a href={whatsappLink} className="text-sm sm:text-base text-primary hover:underline">
                                WhatsApp directo
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {hasContactEmail && (
                    <div className="flex items-start gap-2.5 sm:gap-3">
                      <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm sm:text-base font-medium text-foreground">Correo</p>
                        <a href={`mailto:${contactEmail}`} className="text-sm sm:text-base text-primary hover:underline">
                          {contactEmail}
                        </a>
                      </div>
                    </div>
                  )}

                  {hasSocials && (
                    <>
                      <hr className="border-border" />
                      <div>
                        <p className="text-sm sm:text-base font-medium text-foreground mb-2 sm:mb-3">Síguenos</p>
                      <div className="grid sm:grid-cols-2 gap-2 sm:gap-3">
                        {socials.map((social) => (
                          <a 
                            key={social.key}
                            href={social.url}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-secondary text-[12px] sm:text-sm text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          >
                            <social.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                            {social.label}
                          </a>
                        ))}
                      </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
};

export default HoursLocationPage;
