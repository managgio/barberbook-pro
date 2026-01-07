import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { 
  Scissors, 
  Calendar, 
  Star, 
  Repeat, 
  MapPin, 
  ArrowRight,
  Instagram,
  Phone,
  Mail,
  Twitter,
  Linkedin,
  Youtube,
  Music2,
} from 'lucide-react';
import heroBackground from '@/assets/img/mainImage.webp';
import heroImage from '@/assets/img/portada.png';
import letreroImage from '@/assets/img/letrero.png';
import leBlondLogo from '@/assets/img/leBlongLogo-2.png';
import defaultAvatar from '@/assets/img/default-avatar.svg';
import { Barber, Service } from '@/data/types';
import { getBarbers, getServices } from '@/data/api';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { buildSocialUrl, buildWhatsappLink, formatPhoneDisplay } from '@/lib/siteSettings';

const LandingPage: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { settings } = useSiteSettings();
  const currentYear = new Date().getFullYear();
  const experienceYears = Math.max(0, currentYear - settings.stats.experienceStartYear);
  const formatYearlyBookings = (value: number) => {
    if (value >= 10000) return `${(value / 1000).toFixed(0)}K`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };
  const whatsappLink = buildWhatsappLink(settings.contact.phone) || '#';
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
    { key: 'instagram', label: formatHandle(settings.socials.instagram), icon: Instagram, url: buildSocialUrl('instagram', settings.socials.instagram) },
    { key: 'x', label: formatHandle(settings.socials.x), icon: Twitter, url: buildSocialUrl('x', settings.socials.x) },
    { key: 'tiktok', label: formatHandle(settings.socials.tiktok), icon: Music2, url: buildSocialUrl('tiktok', settings.socials.tiktok) },
    { key: 'youtube', label: formatHandle(settings.socials.youtube), icon: Youtube, url: buildSocialUrl('youtube', settings.socials.youtube) },
    { key: 'linkedin', label: formatHandle(settings.socials.linkedin), icon: Linkedin, url: buildSocialUrl('linkedin', settings.socials.linkedin) },
  ].filter((item) => item.url && item.label);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [barbersData, servicesData] = await Promise.all([getBarbers(), getServices()]);
        setBarbers(barbersData);
        setServices(servicesData);
      } catch (error) {
        console.error('Error loading landing data', error);
      }
    };
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroBackground})` }}
          />
          <div className="absolute inset-0 bg-black/95" />
        </div>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-glow" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-2xl" />
        </div>
        
        <div className="container relative z-10 px-4 py-20">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left animate-slide-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm text-primary font-medium">Reserva online disponible</span>
              </div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
                {settings.branding.name}<br />
                <span className="text-gradient">{settings.branding.tagline}</span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 mb-10">
                {settings.branding.description}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                {isAuthenticated ? (
                  <Button variant="hero" size="xl" asChild>
                    <Link to={user?.role === 'admin' ? '/admin' : '/app/book'}>
                      <Calendar className="w-5 h-5 mr-2" />
                      {user?.role === 'admin' ? 'Panel Admin' : 'Reservar ahora'}
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button variant="hero" size="xl" asChild>
                      <Link to="/auth?tab=signup">
                        <Calendar className="w-5 h-5 mr-2" />
                        Reservar ahora
                      </Link>
                    </Button>
                    <Button variant="outline" size="xl" asChild>
                      <Link to="/book">
                        Reserva sin registro
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 w-full animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="relative w-full max-w-xl mx-auto">
                <div className="absolute -inset-4 bg-primary/20 blur-3xl rounded-[36px]" />
                <img 
                  src={heroImage} 
                  alt="Experiencia premium en Le Blond Hair Salon" 
                  className="relative w-full rounded-[36px] border border-white/10 shadow-2xl object-cover"
                />
                <div className="absolute left-6 right-auto bottom-6 bg-background/80 backdrop-blur-xl rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl border border-border/60">
                  <MapPin className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Visítanos</p>
                    <a
                      href={settings.location.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      {settings.location.label}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto animate-fade-in" style={{ animationDelay: '0.4s' }}>
            {[
              { icon: Scissors, value: `${experienceYears}+`, label: 'Años de experiencia' },
              { icon: Star, value: settings.stats.averageRating.toFixed(1), label: 'Valoración media' },
              { icon: Calendar, value: `${formatYearlyBookings(settings.stats.yearlyBookings)}`, label: 'Reservas/año' },
              { icon: Repeat, value: `${settings.stats.repeatClientsPercentage}%`, label: 'Clientes que repiten' },
            ].map((stat, index) => (
              <div key={stat.label} className="text-center" style={{ animationDelay: `${0.5 + index * 0.1}s` }}>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-24 bg-card/50">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Nuestros servicios
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Cada servicio incluye una experiencia completa con los mejores productos del mercado.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {services.slice(0, 6).map((service, index) => (
              <Card 
                key={service.id} 
                variant="interactive"
                className="animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Scissors className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-right">
                      {service.appliedOffer && service.finalPrice !== undefined && Math.abs(service.price - service.finalPrice) > 0.001 && (
                        <div className="text-xs line-through text-muted-foreground">{service.price}€</div>
                      )}
                      <span className="text-2xl font-bold text-primary">
                        {(service.finalPrice ?? service.price).toFixed(2)}€
                      </span>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{service.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{service.description}</p>
                </CardContent>
              </Card>
            ))}
            {services.length === 0 && (
              <div className="md:col-span-2 lg:col-span-3 text-center text-muted-foreground">
                Cargando servicios...
              </div>
            )}
          </div>

          <div className="text-center mt-12">
            <Button variant="outline" size="lg" asChild>
              <Link to={isAuthenticated ? '/app/book' : '/auth'}>
                Ver todos los servicios
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Barbers Section */}
      <section className="py-24">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Nuestro equipo
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Profesionales apasionados por su oficio, siempre al día con las últimas tendencias.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {barbers.map((barber, index) => (
              <Card 
                key={barber.id} 
                variant="interactive"
                className="overflow-hidden animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="aspect-square relative overflow-hidden">
                  <img 
                    src={barber.photo || defaultAvatar} 
                    alt={barber.name}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-4" />
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground">{barber.name}</h3>
                  <p className="text-sm text-muted-foreground">{barber.specialty}</p>
                </CardContent>
              </Card>
            ))}
            {barbers.length === 0 && (
              <div className="md:col-span-2 lg:col-span-4 text-center text-muted-foreground">
                Cargando equipo...
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-card/50 relative overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${letreroImage})`, backgroundPosition: 'top center' }}
          />
          <div className="absolute inset-0 bg-card/80" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />
        </div>
        
        <div className="container px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
              ¿Listo para tu<br />
              <span className="text-gradient">nuevo look?</span>
            </h2>
              <p className="text-xl text-muted-foreground mb-10">
                Reserva tu cita en menos de un minuto y vive la experiencia {settings.branding.name}.
              </p>
            <Button variant="hero" size="xl" asChild>
              <Link to={isAuthenticated ? '/app/book' : '/auth?tab=signup'}>
                <Calendar className="w-5 h-5 mr-2" />
                Reservar mi cita
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <Link to="/" className="flex items-center gap-2 mb-4">
                <img
                  src={leBlondLogo}
                  alt="Le Blond Hair Salon logo"
                  className="w-10 h-10 rounded-lg object-contain shadow-sm"
                />
                <span className="text-xl font-bold text-foreground">{settings.branding.name}</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                Citas rápidas, experiencia premium y un equipo que cuida cada detalle.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-4">Enlaces</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/hours-location" className="hover:text-primary transition-colors">Horario y ubicación</Link></li>
                <li><Link to="/auth" className="hover:text-primary transition-colors">Iniciar sesión</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-4">Contacto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <a
                    href={settings.location.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors"
                  >
                    {settings.location.label}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <a href={whatsappLink} className="hover:text-primary transition-colors">
                  {phoneDisplay}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <a href={`mailto:${settings.contact.email}`} className="hover:text-primary transition-colors">
                    {settings.contact.email}
                  </a>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-4">Síguenos</h4>
              {socials.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {socials.map((social) => (
                    <a
                      key={social.key}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors gap-2"
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
          </div>
          
          <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <p>
              © {currentYear} by{' '}
              <a
                href="https://clmonreal.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground underline-offset-4 hover:text-primary hover:underline transition-colors"
              >
                Carlos López
              </a>. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
