import { useEffect } from 'react';
import { AlertTriangle, Globe, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { applyTheme, MANAGGIO_PRIMARY } from '@/lib/theme';

type TenantErrorProps = {
  error: {
    code: string;
    message: string;
  };
};

const getBaseDomain = (hostname: string) => {
  if (!hostname) return '';
  if (hostname.endsWith('.localhost')) return 'localhost';
  if (hostname === 'localhost') return 'localhost';
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join('.');
};

const TenantError = ({ error }: TenantErrorProps) => {
  useEffect(() => {
    applyTheme(MANAGGIO_PRIMARY);
    return () => applyTheme();
  }, []);

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const baseDomain = getBaseDomain(hostname);
  const showExample = baseDomain === 'localhost' || hostname.includes('managgio');

  const title =
    error.code === 'missing-subdomain'
      ? 'Subdominio requerido'
      : error.code === 'not-found'
        ? 'Tenant no encontrado'
        : 'No se pudo cargar el tenant';

  const description =
    error.code === 'missing-subdomain'
      ? 'Esta app solo funciona en un subdominio válido.'
      : error.code === 'not-found'
        ? 'No existe un cliente asociado a este subdominio.'
        : 'Hubo un problema al resolver el cliente. Inténtalo de nuevo.';

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary/15 via-background to-background" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-xl rounded-2xl border border-border/60 bg-card/80 backdrop-blur shadow-xl p-8 sm:p-10">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold text-foreground">{title}</h1>
          <p className="mt-3 text-base text-muted-foreground">{description}</p>

          <div className="mt-6 rounded-xl border border-border/60 bg-muted/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="h-4 w-4" />
              <span>Dominio: {hostname || 'desconocido'}</span>
            </div>
            {showExample && (
              <div className="text-sm text-muted-foreground">
                Usa un subdominio válido, con estructura: <span className="font-medium text-foreground">nombre.{baseDomain}</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button onClick={() => window.location.reload()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantError;
