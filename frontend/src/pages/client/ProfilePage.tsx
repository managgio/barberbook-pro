import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { User, Mail, Phone, Bell, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { deleteUser } from '@/data/api';

const ProfilePage: React.FC = () => {
  const { user, updateProfile, logout } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [notificationPrefs, setNotificationPrefs] = useState({
    email: user?.notificationPrefs?.email ?? true,
    whatsapp: user?.notificationPrefs?.whatsapp ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));

      await updateProfile({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        notificationPrefs,
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
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Mi perfil</h1>
        <p className="text-muted-foreground mt-1">
          Actualiza tu información personal y preferencias.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Info */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Información personal
            </CardTitle>
            <CardDescription>
              Actualiza tus datos de contacto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Tu nombre"
                  className="pl-10"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  className="pl-10"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono móvil</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+34 600 000 000"
                  className="pl-10"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Preferencias de notificación
            </CardTitle>
            <CardDescription>
              Elige cómo quieres recibir recordatorios de tus citas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label htmlFor="email-notif">Notificaciones por email</Label>
                <p className="text-sm text-muted-foreground">
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

            <hr className="border-border" />

            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label htmlFor="whatsapp-notif">Notificaciones por WhatsApp</Label>
                <p className="text-sm text-muted-foreground">
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
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Guardar cambios
        </Button>

        {/* Danger zone */}
        <Card variant="elevated" className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Zona peligrosa</CardTitle>
            <CardDescription>
              Eliminar tu perfil borrará también todas tus citas asociadas. Esta acción no se puede deshacer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              type="button"
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
