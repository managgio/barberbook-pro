import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { User, Mail, Phone, Bell, Loader2, Award } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getLoyaltySummary } from '@/data/api/loyalty';
import { deleteUser } from '@/data/api/users';
import { fetchBarbersCached } from '@/lib/catalogQuery';
import { queryKeys } from '@/lib/queryKeys';
import { LoyaltySummary } from '@/data/types';
import LoyaltyProgressPanel from '@/components/common/LoyaltyProgressPanel';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useBusinessCopy } from '@/lib/businessCopy';
import { useQuery } from '@tanstack/react-query';

const ProfilePage: React.FC = () => {
  const { user, updateProfile, logout } = useAuth();
  const { tenant, currentLocationId } = useTenant();
  const { toast } = useToast();
  const copy = useBusinessCopy();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loyaltySummary, setLoyaltySummary] = useState<LoyaltySummary | null>(null);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  });
  const [notificationPrefs, setNotificationPrefs] = useState({
    email: user?.notificationPrefs?.email ?? true,
    whatsapp: user?.notificationPrefs?.whatsapp ?? true,
    sms: user?.notificationPrefs?.sms ?? true,
  });
  const [prefersBarberSelection, setPrefersBarberSelection] = useState(
    user?.prefersBarberSelection ?? true,
  );

  const notificationConfig = tenant?.config?.notificationPrefs;
  const allowEmail = notificationConfig?.email !== false;
  const allowWhatsapp = notificationConfig?.whatsapp !== false;
  const allowSms = notificationConfig?.sms !== false;
  const barbersQuery = useQuery({
    queryKey: queryKeys.barbers(currentLocationId),
    enabled: Boolean(currentLocationId),
    staleTime: 60_000,
    queryFn: () => fetchBarbersCached({ localId: currentLocationId }),
  });
  const hasMultipleBarbers =
    barbersQuery.data === undefined
      ? true
      : barbersQuery.data.filter((barber) => barber.isActive !== false).length > 1;

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    getLoyaltySummary(user.id)
      .then((data) => {
        if (isMounted) setLoyaltySummary(data);
      })
      .catch(() => {
        if (isMounted) setLoyaltySummary(null);
      });
    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setFormData({
      name: user.name || '',
      phone: user.phone || '',
    });
    setNotificationPrefs({
      email: user.notificationPrefs?.email ?? true,
      whatsapp: user.notificationPrefs?.whatsapp ?? true,
      sms: user.notificationPrefs?.sms ?? true,
    });
    setPrefersBarberSelection(user.prefersBarberSelection ?? true);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));

      const normalizedPrefs = {
        email: allowEmail ? notificationPrefs.email : false,
        whatsapp: allowWhatsapp ? notificationPrefs.whatsapp : false,
        sms: allowSms ? notificationPrefs.sms : false,
      };

      await updateProfile({
        name: formData.name,
        phone: formData.phone,
        notificationPrefs: normalizedPrefs,
        prefersBarberSelection,
      });

      toast({
        title: 'Perfil actualizado',
        description: 'Tus datos han sido guardados correctamente.',
      });
    } catch (error) {
      toast({
        title: 'No se pudo actualizar',
        description: 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      await deleteUser(user.id);
      await logout();
      toast({
        title: 'Perfil eliminado',
        description: 'Tu cuenta y citas asociadas se han eliminado.',
      });
    } catch (error) {
      toast({
        title: 'No se pudo eliminar',
        description: 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold text-foreground">Mi perfil</h1>
        <p className="text-xs sm:text-base text-muted-foreground mt-0.5 sm:mt-1">
          Actualiza tu información personal y preferencias.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Personal Info */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Información personal
            </CardTitle>
            <CardDescription className="hidden sm:block">
              Actualiza tus datos de contacto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Tu nombre"
                  className="h-9 sm:h-10 pl-9 sm:pl-10 text-sm"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo actual</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  className="h-9 sm:h-10 pl-9 sm:pl-10 text-sm"
                  value={user?.email || ''}
                  disabled
                />
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                El cambio de correo estará disponible próximamente.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono móvil</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+34 600 000 000"
                  className="h-9 sm:h-10 pl-9 sm:pl-10 text-sm"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {loyaltySummary?.enabled && (
          <Card id="loyalty" variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Award className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                Fidelización
              </CardTitle>
              <CardDescription className="hidden sm:block">
                Consulta tu progreso y las recompensas disponibles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              {loyaltySummary.programs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay tarjetas activas en este momento.
                </p>
              ) : (
                <div className="grid gap-3 sm:gap-4">
                  {loyaltySummary.programs.map(({ program, progress, rewards }) => (
                    <div key={program.id} className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4">
                      <LoyaltyProgressPanel program={program} progress={progress} variant="full" />
                      <div className="mt-3 sm:mt-4 border-t border-border/60 pt-2.5 sm:pt-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Historial de recompensas
                          </p>
                          {rewards.length > 0 && (
                            <span className="text-[11px] text-muted-foreground">
                              {rewards.length} recompensa{rewards.length === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                        {rewards.length === 0 ? (
                          <p className="mt-2 text-[11px] sm:text-xs text-muted-foreground">
                            Aún no has canjeado recompensas en esta tarjeta.
                          </p>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {rewards.map((reward) => (
                              <div
                                key={reward.appointmentId}
                                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-xs sm:text-sm font-medium text-foreground">
                                    {reward.serviceName ?? 'Servicio'}
                                  </p>
                                  <p className="text-[11px] sm:text-xs text-muted-foreground">
                                    {format(parseISO(reward.startDateTime), 'd MMM yyyy', { locale: es })}
                                  </p>
                                </div>
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                  Gratis
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notification Preferences */}
        {(allowEmail || allowWhatsapp || allowSms) && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                Preferencias de notificación
              </CardTitle>
              <CardDescription className="hidden sm:block">
                Elige cómo quieres recibir recordatorios de tus citas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 sm:space-y-4">
              {allowEmail && (
                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notif">Notificaciones por email</Label>
                    <p className="hidden sm:block text-sm text-muted-foreground">
                      Recibe recordatorios por correo electrónico.
                    </p>
                  </div>
                  <Switch
                    id="email-notif"
                    checked={notificationPrefs.email}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs({ ...notificationPrefs, email: checked })
                    }
                  />
                </div>
              )}

              {allowEmail && (allowWhatsapp || allowSms) && <hr className="border-border" />}

              {allowWhatsapp && (
                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="whatsapp-notif">Notificaciones por WhatsApp</Label>
                    <p className="hidden sm:block text-sm text-muted-foreground">
                      Recibe recordatorios por WhatsApp.
                    </p>
                  </div>
                  <Switch
                    id="whatsapp-notif"
                    checked={notificationPrefs.whatsapp}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs({ ...notificationPrefs, whatsapp: checked })
                    }
                  />
                </div>
              )}

              {allowWhatsapp && allowSms && <hr className="border-border" />}

              {allowSms && (
                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="sms-notif">Notificaciones por SMS</Label>
                    <p className="hidden sm:block text-sm text-muted-foreground">
                      Recibe recordatorios por mensaje de texto.
                    </p>
                  </div>
                  <Switch
                    id="sms-notif"
                    checked={notificationPrefs.sms}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs({ ...notificationPrefs, sms: checked })
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {hasMultipleBarbers && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                Preferencias de reserva
              </CardTitle>
              <CardDescription className="hidden sm:block">
                Decide si quieres elegir {copy.staff.singularLower} al pedir tu cita.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="barber-select-pref">Elegir {copy.staff.singularLower}</Label>
                  <p className="hidden sm:block text-sm text-muted-foreground">
                    Si lo desactivas, asignaremos automáticamente a {copy.staff.indefiniteSingular} disponible.
                  </p>
                </div>
                <Switch
                  id="barber-select-pref"
                  checked={prefersBarberSelection}
                  onCheckedChange={setPrefersBarberSelection}
                />
              </div>
              <p className="hidden sm:block text-xs text-muted-foreground">
                Podrás cambiar esta decisión en cada reserva.
              </p>
            </CardContent>
          </Card>
        )}

        <Button type="submit" className="w-full h-9 sm:h-11 text-xs sm:text-base" size="lg" disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Guardar cambios
        </Button>

        {/* Danger zone */}
        <Card variant="elevated" className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive text-base sm:text-lg">Zona peligrosa</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Eliminar tu perfil borrará también todas tus citas asociadas. Esta acción no se puede deshacer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              type="button"
              className="h-9 sm:h-10 text-xs sm:text-sm"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isDeleting}
            >
              Eliminar mi cuenta
            </Button>
          </CardContent>
        </Card>
      </form>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tu cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán tu perfil y todas tus citas asociadas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              type="button"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProfilePage;
