import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, User, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import leBlondLogo from '@/assets/img/leBlongLogo-2.png';
import heroImage from '@/assets/img/mainImage.webp';

const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(initialTab);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const { login, loginWithGoogle, signup, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated && user) {
      navigate(user.role === 'admin' ? '/admin' : '/app');
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let result;
      if (activeTab === 'login') {
        result = await login(formData.email, formData.password);
      } else {
        result = await signup(formData.name, formData.email, formData.password);
      }

      if (result.success) {
        toast({
          title: activeTab === 'login' ? '¡Bienvenido!' : '¡Cuenta creada!',
          description: activeTab === 'login' ? 'Has iniciado sesión correctamente.' : 'Tu cuenta ha sido creada.',
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
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-card relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-black/85" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-transparent to-transparent" />
        <div className="absolute inset-y-0 right-0 w-48 bg-gradient-to-l from-background via-background/5 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] bg-primary/30 rounded-full blur-[180px]" />
        
        <div className="relative z-10 flex flex-col justify-center px-12">
          <Link to="/" className="flex items-center gap-3 mb-8">
            <img
              src={leBlondLogo}
              alt="Le Blond Hair Salon logo"
              className="w-14 h-14 rounded-xl shadow-glow object-contain"
            />
            <span className="text-3xl font-bold text-foreground">Le Blond</span>
          </Link>
          
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Tu estilo,<br />
            <span className="text-gradient">tu momento.</span>
          </h1>
          
          <p className="text-muted-foreground text-lg max-w-md">
            Reserva tu cita en segundos y disfruta de la experiencia boutique de Le Blond Hair Salon en Valencia.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-6">
            {[
              { value: '15+', label: 'Años de experiencia' },
              { value: '5K+', label: 'Clientes satisfechos' },
              { value: '4.9', label: 'Valoración media' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <Link to="/" className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <img
              src={leBlondLogo}
              alt="Le Blond Hair Salon logo"
              className="w-10 h-10 rounded-lg object-contain shadow-sm"
            />
            <span className="text-xl font-bold text-foreground">Le Blond</span>
          </Link>

          <div className="flex justify-end mb-4">
            <Link to="/" className="text-xs uppercase tracking-wide text-primary hover:underline">
              ← Volver al inicio
            </Link>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-secondary rounded-lg p-1 mb-8">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === 'login'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => setActiveTab('signup')}
              className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === 'signup'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Registrarse
            </button>
          </div>

          {/* Google Login */}
          <Button
            variant="outline"
            className="w-full mb-6 h-12"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
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

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                O continúa con email
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="name">Nombre completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Tu nombre"
                    className="pl-10 h-12"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required={activeTab === 'signup'}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  className="pl-10 h-12"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 h-12"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-12" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {activeTab === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </Button>
          </form>

          {/* Demo hint */}
          <div className="mt-6 space-y-3">
            <div className="flex flex-col gap-4 text-center">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">¿Solo quieres una cita rápida?</p>
                <Button variant="outline" asChild>
                  <Link to="/book">Reserva sin registrarte</Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <p className="text-xs text-muted-foreground text-center">
                Autenticación real con Firebase. Inicia sesión con Google o crea tu cuenta con email y contraseña.
                Si usas <code className="text-primary">admin@barberia.com</code> se asignará el rol de administrador automáticamente.
              </p>
            </div>
          </div>

          {/* Footer left empty intentionally */}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
