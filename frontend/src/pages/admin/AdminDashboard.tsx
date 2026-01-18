import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { getAppointments, getBarbers, getServices, getUsers, updateSiteSettings } from '@/data/api';
import { Appointment, Barber, Service, User } from '@/data/types';
import {
  Calendar,
  ArrowRight,
  Clock,
  DollarSign,
  AlertTriangle,
  UserX,
  HelpCircle,
  QrCode,
  Share2,
  Download,
  Loader2,
  RefreshCcw,
  Copy,
} from 'lucide-react';
import {
  format,
  isToday,
  parseISO,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  subDays,
  isSameDay,
  eachDayOfInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useAdminPermissions } from '@/context/AdminPermissionsContext';
import { useToast } from '@/hooks/use-toast';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { deleteFromImageKit, uploadToImageKit } from '@/lib/imagekit';
import { isAppointmentActive, isAppointmentRevenueStatus } from '@/lib/appointmentStatus';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

const rangeOptions = [
  { label: '7 días', value: 7 },
  { label: '14 días', value: 14 },
  { label: '30 días', value: 30 },
];

const QR_SIZE = 768;
const SERVICE_MIX_COLORS = ['#22c55e', '#0ea5e9', '#f97316', '#eab308', '#14b8a6', '#94a3b8'];

const InfoDialog: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
        <HelpCircle className="h-4 w-4 text-muted-foreground" />
      </Button>
    </DialogTrigger>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Guía rápida para aprovechar esta gráfica.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 text-sm text-muted-foreground">
        {children}
      </div>
    </DialogContent>
  </Dialog>
);

const AdminDashboard: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revenueRange, setRevenueRange] = useState(7);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [isCopyingQrUrl, setIsCopyingQrUrl] = useState(false);
  const [qrAction, setQrAction] = useState<'share' | 'download' | null>(null);
  const { canAccessSection } = useAdminPermissions();
  const { toast } = useToast();
  const { settings, isLoading: isSettingsLoading } = useSiteSettings();
  const qrSticker = settings.qrSticker;

  useEffect(() => {
    const fetchData = async () => {
      const [appts, barbersData, servicesData, usersData] = await Promise.all([
        getAppointments(),
        getBarbers(),
        getServices(),
        getUsers(),
      ]);
      setAppointments(appts);
      setBarbers(barbersData);
      setServices(servicesData);
      setUsers(usersData);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const todayAppointments = appointments.filter(
    (appointment) =>
      isToday(parseISO(appointment.startDateTime)) && isAppointmentActive(appointment.status),
  );

  const weekStart = startOfWeek(new Date(), { locale: es });
  const weekEnd = endOfWeek(new Date(), { locale: es });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weekdayLabels = weekDays.map((day) => format(day, 'EEE', { locale: es }));

  const getBarber = (id: string) => barbers.find((barber) => barber.id === id);
  const getService = (id: string) => services.find((service) => service.id === id);
  const getClient = (id: string | null) => users.find((user) => user.id === id);
  const revenueToday = appointments
    .filter(
      (appointment) =>
        isToday(parseISO(appointment.startDateTime)) && isAppointmentRevenueStatus(appointment.status),
    )
    .reduce((total, appointment) => total + (appointment.price || 0), 0);

  const weekCancelled = appointments.filter(
    (appointment) =>
      appointment.status === 'cancelled' &&
      isWithinInterval(parseISO(appointment.startDateTime), { start: weekStart, end: weekEnd }),
  ).length;
  const weekNoShow = appointments.filter(
    (appointment) =>
      appointment.status === 'no_show' &&
      isWithinInterval(parseISO(appointment.startDateTime), { start: weekStart, end: weekEnd }),
  ).length;

  const occupancyHours = Array.from({ length: 12 }).map((_, index) => 9 + index);
  const occupancyMatrix = occupancyHours.map(() => weekDays.map(() => 0));
  appointments.forEach((appointment) => {
    if (!isAppointmentActive(appointment.status)) return;
    const startDate = parseISO(appointment.startDateTime);
    if (!isWithinInterval(startDate, { start: weekStart, end: weekEnd })) return;
    const dayIndex = weekDays.findIndex((day) => isSameDay(day, startDate));
    if (dayIndex === -1) return;
    const hourIndex = occupancyHours.indexOf(startDate.getHours());
    if (hourIndex === -1) return;
    occupancyMatrix[hourIndex][dayIndex] += 1;
  });
  const maxOccupancy = Math.max(1, ...occupancyMatrix.flat());

  const serviceMixRangeDays = 30;
  const serviceMixStart = subDays(new Date(), serviceMixRangeDays - 1);
  const serviceMixAppointments = appointments.filter(
    (appointment) =>
      isAppointmentRevenueStatus(appointment.status) &&
      isWithinInterval(parseISO(appointment.startDateTime), { start: serviceMixStart, end: new Date() }),
  );
  const serviceMixCounts = serviceMixAppointments.reduce<Record<string, number>>((acc, appointment) => {
    const serviceName = getService(appointment.serviceId)?.name || 'Servicio eliminado';
    acc[serviceName] = (acc[serviceName] || 0) + 1;
    return acc;
  }, {});
  const serviceMixEntries = Object.entries(serviceMixCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const topServiceMix = serviceMixEntries.slice(0, 5);
  const otherServiceCount = serviceMixEntries.slice(5).reduce((sum, item) => sum + item.value, 0);
  const serviceMixData = otherServiceCount > 0 ? [...topServiceMix, { name: 'Otros', value: otherServiceCount }] : topServiceMix;
  const serviceMixTotal = serviceMixData.reduce((sum, item) => sum + item.value, 0);

  const ticketRangeDays = 14;
  const ticketDays = Array.from({ length: ticketRangeDays }).map((_, index) =>
    subDays(new Date(), ticketRangeDays - 1 - index),
  );
  const ticketData = ticketDays.map((day) => {
    const dayAppointments = serviceMixAppointments.filter((appointment) =>
      isSameDay(parseISO(appointment.startDateTime), day),
    );
    const total = dayAppointments.reduce((sum, appointment) => sum + (appointment.price || 0), 0);
    const average = dayAppointments.length > 0 ? total / dayAppointments.length : 0;
    return {
      label: format(day, 'dd MMM', { locale: es }),
      value: Number(average.toFixed(2)),
    };
  });
  const ticketAverage = ticketData.reduce((sum, item) => sum + item.value, 0) / (ticketData.length || 1);

  const lossRangeDays = 30;
  const lossStart = subDays(new Date(), lossRangeDays - 1);
  const lossWeekdayData = weekdayLabels.map((label) => ({
    label,
    no_show: 0,
    cancelled: 0,
  }));
  appointments.forEach((appointment) => {
    if (appointment.status !== 'no_show' && appointment.status !== 'cancelled') return;
    const startDate = parseISO(appointment.startDateTime);
    if (!isWithinInterval(startDate, { start: lossStart, end: new Date() })) return;
    const dayIndex = Number(format(startDate, 'i')) - 1;
    if (dayIndex < 0 || dayIndex > 6) return;
    if (appointment.status === 'no_show') {
      lossWeekdayData[dayIndex].no_show += 1;
    } else {
      lossWeekdayData[dayIndex].cancelled += 1;
    }
  });

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
      const { url, fileId } = await uploadToImageKit(qrBlob, buildQrFileName());
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

  const handleCopyQrUrl = async () => {
    if (!qrSticker || isCopyingQrUrl) return;
    if (!navigator.clipboard?.writeText) {
      toast({
        title: 'No se pudo copiar',
        description: 'Tu navegador no permite copiar automáticamente.',
        variant: 'destructive',
      });
      return;
    }
    setIsCopyingQrUrl(true);
    try {
      await navigator.clipboard.writeText(qrSticker.url);
      toast({
        title: 'Enlace copiado',
        description: 'El link del negocio está listo para compartir.',
      });
    } catch (error) {
      toast({
        title: 'No se pudo copiar',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setIsCopyingQrUrl(false);
    }
  };

  const selectedDays = Array.from({ length: revenueRange }).map((_, index) =>
    subDays(new Date(), revenueRange - 1 - index)
  );
  const revenueData = selectedDays.map((day) => {
    const dayAppointments = appointments.filter(
      (appointment) =>
        isAppointmentRevenueStatus(appointment.status) && isSameDay(parseISO(appointment.startDateTime), day),
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
                    <div className="flex items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              disabled={isCopyingQrUrl || isGeneratingQr || isSettingsLoading}
                              aria-label="Copiar enlace"
                              onClick={handleCopyQrUrl}
                            >
                              {isCopyingQrUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">Copiar enlace</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
            label: 'Ingresos hoy', 
            value: currencyFormatter.format(revenueToday), 
            icon: DollarSign,
            color: 'text-green-500',
          },
          { 
            label: 'Cancelaciones semana', 
            value: weekCancelled, 
            icon: AlertTriangle,
            color: 'text-rose-500',
          },
          { 
            label: 'Ausencias semana', 
            value: weekNoShow, 
            icon: UserX,
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
        <Card variant="elevated" className="h-[420px] flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Citas de hoy</CardTitle>
            {canAccessSection('calendar') && (
              <Link to="/admin/calendar" className="text-sm text-primary hover:underline flex items-center">
                Ver calendario
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <ListSkeleton count={3} />
              </div>
            ) : todayAppointments.length > 0 ? (
              <div className="h-full overflow-y-auto pr-1 space-y-3">
                {todayAppointments.map((appointment) => {
                  const barber = getBarber(appointment.barberId);
                  const service = getService(appointment.serviceId);
                  const time = format(parseISO(appointment.startDateTime), 'HH:mm');
                  const clientName =
                    appointment.guestName ||
                    (appointment.userId ? getClient(appointment.userId)?.name : undefined);
                  
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
                        <p className="text-sm text-muted-foreground truncate">
                          Cliente: {clientName || 'Sin nombre'}
                        </p>
                        <p className="text-sm text-muted-foreground">con {barber?.name}</p>
                      </div>
                      <span className="text-lg font-semibold text-primary">{time}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No hay citas programadas para hoy
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue chart */}
        <Card variant="elevated" className="h-[420px] flex flex-col">
          <CardHeader className="flex flex-col gap-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Ingresos últimos {revenueRange} días</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Seguimiento diario de ingresos estimados según citas completadas.
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
          <CardContent className="flex-1">
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

      <div className="grid lg:grid-cols-2 gap-6">
        <Card variant="elevated" className="min-w-0">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Mix de servicios</CardTitle>
              <InfoDialog title="Mix de servicios">
                <p>
                  El gráfico de queso muestra qué servicios se han pedido más en los últimos 30 días.
                  Las porciones grandes son los más elegidos y "Otros" agrupa lo menos frecuente.
                </p>
                <p>
                  El número del centro es el total de citas completadas en ese periodo.
                </p>
                <p>
                  La línea de ticket medio enseña el gasto promedio por cita en los últimos 14 días.
                  Si sube, cada cliente deja más; si baja, revisa precios, promos o el tipo de servicio.
                </p>
                <p>
                  Úsalo para decidir qué servicios potenciar, ajustar precios o diseñar ofertas.
                </p>
              </InfoDialog>
            </div>
            <p className="text-sm text-muted-foreground">
              Distribución de servicios (30 días) y ticket medio.
            </p>
          </CardHeader>
          <CardContent className="h-[620px] md:h-[320px]">
            {serviceMixData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No hay datos suficientes para mostrar.
              </div>
            ) : (
              <div className="grid h-full gap-10 md:gap-4 md:grid-cols-[1.1fr_0.9fr]">
                <div className="flex flex-col">
                  <div className="relative h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={serviceMixData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={48}
                          outerRadius={72}
                          paddingAngle={3}
                        >
                          {serviceMixData.map((entry, index) => (
                            <Cell key={`cell-${entry.name}`} fill={SERVICE_MIX_COLORS[index % SERVICE_MIX_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{ background: 'hsl(var(--card))', borderRadius: '12px', border: 'none' }}
                          itemStyle={{ color: '#fff', fontSize: '12px', lineHeight: '1.4' }}
                          labelStyle={{ color: '#fff', fontSize: '12px', lineHeight: '1.4' }}
                          wrapperStyle={{ zIndex: 20 }}
                          formatter={(value: number) => `${value} citas`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 z-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xs text-muted-foreground">Servicios</span>
                      <span className="text-lg font-semibold text-foreground">{serviceMixTotal}</span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    {serviceMixData.map((item, index) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: SERVICE_MIX_COLORS[index % SERVICE_MIX_COLORS.length] }}
                        />
                        <span className="truncate">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Ticket medio (14 días)</p>
                    <p className="text-sm font-semibold text-foreground">
                      {currencyFormatter.format(ticketAverage || 0)}
                    </p>
                  </div>
                  <div className="mt-3 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={ticketData} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tickFormatter={(value) => `${Math.round(value)}€`}
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RechartsTooltip
                          contentStyle={{ background: 'hsl(var(--card))', borderRadius: '12px', border: 'none' }}
                          formatter={(value: number) => [currencyFormatter.format(value), 'Ticket medio']}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#22c55e' }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Ausencias y cancelaciones</CardTitle>
              <InfoDialog title="Ausencias y cancelaciones">
                <p>
                  Cada barra corresponde a un día de la semana. Cuanto más alta, más incidencias.
                </p>
                <p>
                  "Ausencias" son clientes que no se presentan; "Canceladas" son citas anuladas.
                </p>
                <p>
                  Si un día destaca, puedes reforzar recordatorios, pedir señal o ajustar el
                  horario de ese día para reducir pérdidas.
                </p>
              </InfoDialog>
            </div>
            <p className="text-sm text-muted-foreground">
              Distribución por día de la semana (últimos 30 días).
            </p>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lossWeekdayData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  contentStyle={{ background: 'hsl(var(--card))', borderRadius: '12px', border: 'none' }}
                  formatter={(value: number, name: string) => {
                    if (name === 'no_show' || name === 'Ausencias') return [value, 'Ausencias'];
                    if (name === 'cancelled' || name === 'Canceladas') return [value, 'Canceladas'];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="no_show" name="Ausencias" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="cancelled" name="Canceladas" fill="hsl(var(--muted-foreground) / 0.4)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card variant="elevated">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Ocupación semanal</CardTitle>
              <InfoDialog title="Ocupación semanal">
                <p>
                  Las columnas son los días y las filas son las horas. Cuanto más intenso el color,
                  más citas hay en esa franja.
                </p>
                <p>
                  Te ayuda a ver de un vistazo las horas punta y los huecos reales.
                </p>
                <p>
                  Úsalo para ajustar horarios del equipo, abrir huecos en horas flojas o lanzar
                  ofertas en tramos con baja ocupación.
                </p>
              </InfoDialog>
            </div>
            <p className="text-sm text-muted-foreground">
              Mapa de intensidad por franja horaria en la semana actual.
            </p>
          </CardHeader>
          <CardContent className="h-[320px] min-w-0 overflow-hidden">
            <div className="h-full w-full min-w-0 overflow-x-auto overflow-y-auto">
              <div className="min-w-auto space-y-2">
                <div className="grid grid-cols-[44px_repeat(7,minmax(48px,1fr))] gap-2 text-xs text-muted-foreground">
                  <div />
                  {weekdayLabels.map((label) => (
                    <div key={label} className="text-center">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {occupancyHours.map((hour, rowIndex) => (
                    <div key={hour} className="grid grid-cols-[44px_repeat(7,minmax(48px,1fr))] gap-2 items-center">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {hour.toString().padStart(2, '0')}:00
                      </span>
                      {weekDays.map((day, colIndex) => {
                        const value = occupancyMatrix[rowIndex][colIndex];
                        const intensity = value / maxOccupancy;
                        return (
                          <div
                            key={`${day.toISOString()}-${hour}`}
                            className="h-6 rounded-md border border-border/60"
                            style={{
                              backgroundColor: `hsl(var(--primary) / ${0.12 + intensity * 0.75})`,
                            }}
                            title={`${format(day, 'EEEE', { locale: es })} · ${hour
                              .toString()
                              .padStart(2, '0')}:00 · ${value} citas`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
