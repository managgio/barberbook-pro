import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getPlatformBrands } from '@/data/api';
import { useToast } from '@/hooks/use-toast';

const PlatformDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [brands, setBrands] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await getPlatformBrands(user.id);
        setBrands(data);
      } catch (error) {
        toast({ title: 'Error', description: 'No se pudo cargar el resumen de plataforma.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user?.id, toast]);

  const stats = useMemo(() => {
    const totalBrands = brands.length;
    const activeBrands = brands.filter((brand) => brand.isActive).length;
    const totalLocations = brands.reduce((acc, brand) => acc + (brand.locations?.length || 0), 0);
    return { totalBrands, activeBrands, totalLocations };
  }, [brands]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Panel principal
        </div>
        <h1 className="text-3xl font-semibold text-foreground">Plataforma Managgio</h1>
        <p className="text-muted-foreground max-w-2xl">
          Controla marcas, locales y configuraciones desde un único espacio. Aquí tienes el estado global de la plataforma.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border/60 bg-card/70">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Marcas activas</CardTitle>
            <Building2 className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {isLoading ? '—' : stats.activeBrands}
            </div>
            <p className="text-xs text-muted-foreground mt-1">de {isLoading ? '—' : stats.totalBrands} marcas</p>
          </CardContent>
        </Card>
        <Card className="border border-border/60 bg-card/70">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Locales registrados</CardTitle>
            <MapPin className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {isLoading ? '—' : stats.totalLocations}
            </div>
            <p className="text-xs text-muted-foreground mt-1">sumando todas las marcas</p>
          </CardContent>
        </Card>
        <Card className="border border-border/60 bg-card/70">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Admins plataforma</CardTitle>
            <ShieldCheck className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">—</div>
            <p className="text-xs text-muted-foreground mt-1">configurable desde usuarios</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PlatformDashboard;
