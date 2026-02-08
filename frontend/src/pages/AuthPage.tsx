import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, User, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import managgioLogo80Avif from '@/assets/img/managgio/logo-app-80.avif';
import managgioLogo160Avif from '@/assets/img/managgio/logo-app-160.avif';
import managgioLogo80Webp from '@/assets/img/managgio/logo-app-80.webp';
import managgioLogo160Webp from '@/assets/img/managgio/logo-app-160.webp';
import managgioHero960Avif from '@/assets/img/managgio/fondo-managgio-960.avif';
import managgioHero1440Avif from '@/assets/img/managgio/fondo-managgio-1440.avif';
import managgioHero960Webp from '@/assets/img/managgio/fondo-managgio-960.webp';
import managgioHero1440Webp from '@/assets/img/managgio/fondo-managgio-1440.webp';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useTenant } from '@/context/TenantContext';
import LegalFooter from '@/components/layout/LegalFooter';
import { resolveBrandLogo } from '@/lib/branding';

const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';
  const rawRedirect = searchParams.get('redirect');
  const redirectTarget =
    rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : null;
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(initialTab);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const { login, loginWithGoogle, signup, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { settings } = useSiteSettings();
  const { tenant } = useTenant();
  const isPlatform = Boolean(tenant?.isPlatform);
  const isLocalEnv = typeof window !== 'undefined'
    && (import.meta.env.DEV
      || window.location.hostname === 'localhost'
      || window.location.hostname === '127.0.0.1'
      || window.location.hostname.endsWith('.localhost'));
  const leBlondLogo = '/leBlondLogo.png';
  const heroImageFallback = '/placeholder.svg';
  const heroImage = tenant?.config?.branding?.heroBackgroundUrl || heroImageFallback;
  const brandLogo = resolveBrandLogo(tenant, leBlondLogo);
  const heroBackgroundDimmed = tenant?.config?.branding?.heroBackgroundDimmed !== false;
  const platformHeroAvifSrcSet = `${managgioHero960Avif} 960w, ${managgioHero1440Avif} 1440w`;
  const platformHeroWebpSrcSet = `${managgioHero960Webp} 960w, ${managgioHero1440Webp} 1440w`;
  const platformLogoAvifSrcSet = `${managgioLogo80Avif} 80w, ${managgioLogo160Avif} 160w`;
  const platformLogoWebpSrcSet = `${managgioLogo80Webp} 80w, ${managgioLogo160Webp} 160w`;
  const platformHeroFallback = managgioHero1440Webp;
  const platformLogoFallback = managgioLogo160Webp;
  const experienceYears = Math.max(0, new Date().getFullYear() - settings.stats.experienceStartYear);
  const formatYearlyBookings = (value: number) => {
    if (value >= 10000) return `${(value / 1000).toFixed(0)}K`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };
  const isSignup = activeTab === 'signup' && !isPlatform;
  const fromPath = React.useMemo(() => {
    const state = location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null;
    const from = state?.from;
    if (!from?.pathname) return null;
    const candidate = `${from.pathname}${from.search || ''}${from.hash || ''}`;
    if (!candidate.startsWith('/') || candidate.startsWith('//')) return null;
    if (candidate.startsWith('/auth')) return null;
    return candidate;
  }, [location.state]);

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated && user) {
      const preferredTarget = fromPath ?? redirectTarget;
      if (user.isPlatformAdmin && isPlatform) {
        if (preferredTarget?.startsWith('/platform')) {
          navigate(preferredTarget, { replace: true });
          return;
        }
        navigate('/platform', { replace: true });
        return;
      }
      if (preferredTarget && !isPlatform) {
        navigate(preferredTarget, { replace: true });
        return;
      }
      const hasAdminAccess = Boolean(user.isSuperAdmin || user.isLocalAdmin || user.role === 'admin' || user.isPlatformAdmin);
      navigate(hasAdminAccess ? '/admin' : '/app', { replace: true });
    }
  }, [isAuthenticated, user, navigate, isPlatform, redirectTarget, fromPath]);

  React.useEffect(() => {
    if (isPlatform && activeTab !== 'login') {
      setActiveTab('login');
    }
  }, [isPlatform, activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let result;
      if (activeTab === 'login' || isPlatform) {
        result = await login(formData.email, formData.password);
      } else {
        result = await signup(formData.name, formData.email, formData.password);
      }

      if (result.success) {
        toast({
          title: isSignup ? '¡Cuenta creada!' : '¡Bienvenido!',
          description: isSignup ? 'Tu cuenta ha sido creada.' : 'Has iniciado sesión correctamente.',
        });
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Ha ocurrido un error. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const result = await loginWithGoogle();
      if (result.success) {
        toast({
          title: '¡Bienvenido!',
          description: 'Has iniciado sesión con Google.',
        });
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error al conectar con Google.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex flex-1">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-card relative overflow-hidden">
        {isPlatform ? (
          <picture className="absolute inset-0">
            <source
              type="image/avif"
              srcSet={platformHeroAvifSrcSet}
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
            <source
              type="image/webp"
              srcSet={platformHeroWebpSrcSet}
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
            <img
              src={platformHeroFallback}
              alt=""
              aria-hidden="true"
              loading="eager"
              decoding="async"
              width={1440}
              height={804}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </picture>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${heroImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}
        {heroBackgroundDimmed && <div className="absolute inset-0 bg-background/85" />}
        {heroBackgroundDimmed && (
          <div className="absolute inset-0 bg-gradient-to-br from-background/70 via-transparent to-transparent" />
        )}
        <div className="absolute inset-y-0 right-0 w-48 bg-gradient-to-l from-background via-background/5 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] bg-primary/30 rounded-full blur-[180px]" />
        
        <div className="relative z-10 flex flex-col justify-center px-12">
          <Link to="/" className="flex items-center gap-3 mb-8">
            {isPlatform ? (
              <picture>
                <source type="image/avif" srcSet={platformLogoAvifSrcSet} sizes="56px" />
                <source type="image/webp" srcSet={platformLogoWebpSrcSet} sizes="56px" />
                <img
                  src={platformLogoFallback}
                  alt="Managgio logo"
                  width={56}
                  height={56}
                  loading="eager"
                  decoding="async"
                  className="w-14 h-14 rounded-xl shadow-glow object-contain"
                />
              </picture>
            ) : (
              <img
                src={brandLogo}
                alt={`${settings.branding.shortName} logo`}
                width={56}
                height={56}
                loading="eager"
                decoding="async"
                className="w-14 h-14 rounded-xl shadow-glow object-contain"
              />
            )}
            <span className="text-3xl font-bold text-foreground">
              {isPlatform ? 'Managgio' : settings.branding.shortName}
            </span>
          </Link>
          
          <h1 className="text-4xl font-bold text-foreground mb-4">
            {isPlatform ? 'Acceso plataforma' : 'Tu estilo,'}
            <br />
            <span className="text-gradient">{isPlatform ? 'Managgio' : 'tu momento.'}</span>
          </h1>
          
          <p className="text-muted-foreground text-lg max-w-md">
            {isPlatform
              ? 'Gestiona marcas, locales y configuraciones desde la consola central.'
              : `Reserva tu cita en segundos y disfruta de la experiencia de ${settings.branding.name}.`}
          </p>

          {isPlatform ? (
            <div className="mt-10 space-y-3 text-sm text-muted-foreground">
              {[
                'Gestión centralizada de marcas y locales',
                'Configuraciones multi-tenant en tiempo real',
                'Control de permisos por local y rol',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-12 grid grid-cols-3 gap-6">
              {[
                { value: `${experienceYears}+`, label: 'Años de experiencia' },
                { value: `${formatYearlyBookings(settings.stats.yearlyBookings)}+`, label: 'Clientes satisfechos' },
                { value: settings.stats.averageRating.toFixed(1), label: 'Valoración media' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xl font-bold text-primary">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm sm:max-w-md">
          {/* Mobile Logo */}
          <Link to="/" className="lg:hidden flex items-center gap-2 justify-center mb-5 sm:mb-8">
            {isPlatform ? (
              <picture>
                <source type="image/avif" srcSet={platformLogoAvifSrcSet} sizes="40px" />
                <source type="image/webp" srcSet={platformLogoWebpSrcSet} sizes="40px" />
                <img
                  src={platformLogoFallback}
                  alt="Managgio logo"
                  width={40}
                  height={40}
                  loading="eager"
                  decoding="async"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-contain shadow-sm"
                />
              </picture>
            ) : (
              <img
                src={brandLogo}
                alt={`${settings.branding.shortName} logo`}
                width={40}
                height={40}
                loading="eager"
                decoding="async"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-contain shadow-sm"
              />
            )}
            <span className="text-lg sm:text-xl font-bold text-foreground">
              {isPlatform ? 'Managgio' : settings.branding.shortName}
            </span>
          </Link>

          {!isPlatform && (
            <div className="flex justify-end mb-3 sm:mb-4">
              <Link to="/" className="text-[10px] sm:text-xs uppercase tracking-wide text-primary hover:underline">
                ← Volver al inicio
              </Link>
            </div>
          )}

          {/* Tab Switcher */}
          {!isPlatform && (
            <div className="flex bg-secondary rounded-lg p-0.5 sm:p-1 mb-5 sm:mb-8">
              <button
                onClick={() => setActiveTab('login')}
                className={`flex-1 py-2 px-2.5 sm:py-2.5 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 ${
                  activeTab === 'login'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Iniciar sesión
              </button>
              <button
                onClick={() => setActiveTab('signup')}
                className={`flex-1 py-2 px-2.5 sm:py-2.5 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 ${
                  activeTab === 'signup'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Registrarse
              </button>
            </div>
          )}

          {/* Google Login */}
          <Button
            variant="outline"
            className="w-full mb-5 sm:mb-6 h-10 sm:h-12 text-xs sm:text-sm"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuar con Google
          </Button>

          <div className="relative mb-5 sm:mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[10px] sm:text-xs uppercase">
              <span className="bg-background px-1.5 sm:px-2 text-muted-foreground">
                O continúa con email
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {isSignup && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs sm:text-sm">Nombre completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Tu nombre"
                    className="pl-10 h-10 sm:h-12 text-sm"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required={activeTab === 'signup'}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs sm:text-sm">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  className="pl-10 h-10 sm:h-12 text-sm"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs sm:text-sm">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 h-10 sm:h-12 text-sm"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-10 sm:h-12 text-xs sm:text-sm" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isSignup ? 'Crear cuenta' : 'Iniciar sesión'}
            </Button>
          </form>

          {/* Demo hint */}
          {!isPlatform && (
            <div className="mt-5 sm:mt-6 space-y-2.5 sm:space-y-3">
              <div className="flex flex-col gap-4 text-center">
                <div className="space-y-2">
                  <p className="text-xs sm:text-sm text-muted-foreground">¿Solo quieres una cita rápida?</p>
                  <Button variant="outline" className="h-9 sm:h-10 text-xs sm:text-sm" asChild>
                    <Link to="/book">Reserva sin registrarte</Link>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!isPlatform && isLocalEnv && (
            <div className="mt-5 sm:mt-6 space-y-2.5 sm:space-y-3">
              <div className="p-3 sm:p-4 rounded-lg bg-secondary/50 border border-border">
                <p className="text-[11px] sm:text-xs text-muted-foreground text-center">
                  Autenticación real con Firebase. Inicia sesión con Google o crea tu cuenta con email y contraseña.
                  Si usas <code className="text-primary">admin@negocio.com</code> se asignará el rol de administrador automáticamente.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
      </div>
      {!isPlatform && <LegalFooter />}
    </div>
  );
};

export default AuthPage;
