import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { getAppointments, getBarbers, getServices, updateSiteSettings } from '@/data/api';
import { Appointment, Barber, Service } from '@/data/types';
import {
  Calendar,
  TrendingUp,
  ArrowRight,
  Clock,
  DollarSign,
  AlertTriangle,
  QrCode,
  Share2,
  Download,
  Loader2,
  RefreshCcw,
} from 'lucide-react';
import { format, isToday, parseISO, startOfWeek, endOfWeek, isWithinInterval, subDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useAdminPermissions } from '@/context/AdminPermissionsContext';
import { useToast } from '@/hooks/use-toast';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { deleteFromImageKit, uploadToImageKit } from '@/lib/imagekit';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';

const rangeOptions = [
  { label: '7 días', value: 7 },
  { label: '14 días', value: 14 },
  { label: '30 días', value: 30 },
];

const QR_FOLDER = 'qr-stickers';
const QR_SIZE = 768;

const AdminDashboard: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revenueRange, setRevenueRange] = useState(7);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [qrAction, setQrAction] = useState<'share' | 'download' | null>(null);
  const { canAccessSection } = useAdminPermissions();
  const { toast } = useToast();
  const { settings, isLoading: isSettingsLoading } = useSiteSettings();
  const qrSticker = settings.qrSticker;

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

  const revenueToday = todayAppointments.reduce((total, appointment) => total + (appointment.price || 0), 0);

  const weekCancelled = appointments.filter(a => 
    a.status === 'cancelled' &&
    isWithinInterval(parseISO(a.startDateTime), { start: weekStart, end: weekEnd })
  ).length;

  const currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });

  const buildQrFileName = () => {
    const base = settings.branding.shortName || settings.branding.name || 'negocio';
    const slug = base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return `qr-${slug || 'negocio'}.png`;
  };

  const fetchQrBlob = async (url: string) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('No se pudo descargar la imagen del QR.');
    }
    return response.blob();
  };

  const generateQrSticker = async (mode: 'create' | 'regenerate') => {
    if (isGeneratingQr || isSettingsLoading) return;
    if (typeof window === 'undefined') return;
    if (mode === 'create' && qrSticker) return;
    if (mode === 'regenerate' && !qrSticker) return;

    const previousQr = qrSticker;
    const businessUrl = new URL('/', window.location.origin).toString();
    setIsGeneratingQr(true);
    let newFileId: string | null = null;

    try {
      const qrResponse = await fetch(
        `https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&margin=20&color=000000&bgcolor=ffffff&data=${encodeURIComponent(
          businessUrl,
        )}`,
      );
      if (!qrResponse.ok) {
        throw new Error('No se pudo generar el QR. Intenta de nuevo.');
      }
      const qrBlob = await qrResponse.blob();
      const { url, fileId } = await uploadToImageKit(qrBlob, buildQrFileName(), QR_FOLDER);
      newFileId = fileId;
      const updated = await updateSiteSettings({
        ...settings,
        qrSticker: {
          url: businessUrl,
          imageUrl: url,
          imageFileId: fileId,
          createdAt: new Date().toISOString(),
        },
      });
      window.dispatchEvent(new CustomEvent('site-settings-updated', { detail: updated }));

      if (mode === 'regenerate' && previousQr?.imageFileId && previousQr.imageFileId !== fileId) {
        try {
          await deleteFromImageKit(previousQr.imageFileId);
        } catch (cleanupError) {
          toast({
            title: 'Aviso',
            description: 'No se pudo eliminar el QR anterior en ImageKit.',
            variant: 'destructive',
          });
        }
      }

      toast({
        title: mode === 'regenerate' ? 'QR regenerado' : 'QR listo',
        description: 'Ya puedes descargarlo o compartirlo.',
      });
    } catch (error) {
      if (newFileId) {
        try {
          await deleteFromImageKit(newFileId);
        } catch {
          // Ignore cleanup errors when creation fails.
        }
      }
      toast({
        title: mode === 'regenerate' ? 'No se pudo regenerar el QR' : 'No se pudo crear el QR',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handleGenerateQr = async () => {
    await generateQrSticker('create');
  };

  const handleRegenerateQr = async () => {
    await generateQrSticker('regenerate');
  };

  const handleShareQr = async () => {
    if (!qrSticker || qrAction) return;
    setQrAction('share');
    try {
      const shareTitle = `QR de ${settings.branding.shortName || settings.branding.name}`;
      const shareData: ShareData = {
        title: shareTitle,
        text: 'Escanéalo para acceder al negocio.',
        url: qrSticker.url,
      };

      if (navigator.share) {
        try {
          const blob = await fetchQrBlob(qrSticker.imageUrl);
          const file = new File([blob], buildQrFileName(), { type: blob.type || 'image/png' });
          if (!navigator.canShare || navigator.canShare({ files: [file] })) {
            shareData.files = [file];
          }
        } catch {
          // Fallback to sharing the link only.
        }
        await navigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(qrSticker.url);
        toast({
          title: 'Enlace copiado',
          description: 'Comparte el link del negocio donde lo necesites.',
        });
      } else {
        toast({
          title: 'Compartir no disponible',
          description: 'Descarga el QR y compártelo manualmente.',
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      toast({
        title: 'No se pudo compartir',
        description: 'Prueba con descargar la imagen.',
        variant: 'destructive',
      });
    } finally {
      setQrAction(null);
    }
  };

  const handleDownloadQr = async () => {
    if (!qrSticker || qrAction) return;
    setQrAction('download');
    try {
      const blob = await fetchQrBlob(qrSticker.imageUrl);
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = buildQrFileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast({
        title: 'Descarga iniciada',
        description: 'La pegatina QR se ha guardado como PNG.',
      });
    } catch (error) {
      toast({
        title: 'No se pudo descargar',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setQrAction(null);
    }
  };

  const selectedDays = Array.from({ length: revenueRange }).map((_, index) =>
    subDays(new Date(), revenueRange - 1 - index)
  );
  const revenueData = selectedDays.map((day) => {
    const dayAppointments = appointments.filter((appointment) => 
      appointment.status !== 'cancelled' && isSameDay(parseISO(appointment.startDateTime), day)
    );
    const total = dayAppointments.reduce((sum, appointment) => sum + (appointment.price || 0), 0);
    return {
      label: format(day, 'dd MMM', { locale: es }),
      value: total,
    };
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="pl-12 md:pl-0">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Resumen de la actividad de la barbería.
          </p>
        </div>
        <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setIsQrDialogOpen(true)}
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  disabled={isSettingsLoading}
                  aria-label={qrSticker ? 'QR del negocio' : 'Crear QR'}
                >
                  <QrCode className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {qrSticker ? 'QR del negocio' : 'Crear QR'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Pegatina QR del negocio</DialogTitle>
              {!qrSticker && (
                <DialogDescription>
                  Genera una sola vez el QR del sitio para imprimirlo y compartirlo cuando lo necesites.
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="grid gap-5">
              {qrSticker ? (
                <>
                  <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-secondary/50 via-background to-muted/60 p-6">
                    <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,_hsl(var(--primary))/0.12,_transparent_55%)]" />
                    <div className="relative mx-auto w-fit rounded-2xl bg-background p-4 shadow-xl">
                      <img
                        src={qrSticker.imageUrl}
                        alt="QR del negocio"
                        className="h-56 w-56 rounded-lg object-contain"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      onClick={handleShareQr}
                      className="gap-2"
                      disabled={qrAction !== null || isGeneratingQr}
                    >
                      {qrAction === 'share' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                      Compartir
                    </Button>
                    <Button
                      onClick={handleDownloadQr}
                      variant="outline"
                      className="gap-2"
                      disabled={qrAction !== null || isGeneratingQr}
                    >
                      {qrAction === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      Descargar PNG
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-muted-foreground/20 bg-muted/30 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      URL guardada: {qrSticker.url}
                    </p>
                    <AlertDialog>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                disabled={isGeneratingQr || isSettingsLoading}
                                aria-label="Regenerar QR"
                              >
                                <RefreshCcw className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="left">Regenerar QR</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Regenerar QR?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se recomienda regenerar el QR solo si cambia el dominio o la URL pública del negocio. ¿Quieres continuar?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction asChild>
                            <Button
                              variant="destructive"
                              className="gap-2"
                              onClick={handleRegenerateQr}
                              disabled={isGeneratingQr}
                            >
                              {isGeneratingQr ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                              Regenerar
                            </Button>
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed bg-muted/30 p-6 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-background shadow">
                    <QrCode className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">Genera tu pegatina QR</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    El QR apunta a la web del negocio y se guarda para reutilizarlo siempre.
                  </p>
                  <Button
                    onClick={handleGenerateQr}
                    className="mt-5 gap-2"
                    disabled={isGeneratingQr || isSettingsLoading}
                  >
                    {isGeneratingQr ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                    {isGeneratingQr ? 'Generando...' : 'Generar QR'}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
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
            {canAccessSection('calendar') && (
              <Link to="/admin/calendar" className="text-sm text-primary hover:underline flex items-center">
                Ver calendario
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            )}
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
                <RechartsTooltip
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
