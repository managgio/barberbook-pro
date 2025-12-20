import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getAlerts, createAlert, updateAlert, deleteAlert } from '@/data/api';
import { Alert as AlertType } from '@/data/types';
import { Plus, Pencil, Trash2, Bell, Info, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ListSkeleton } from '@/components/common/Skeleton';
import EmptyState from '@/components/common/EmptyState';
import { cn } from '@/lib/utils';

const AdminAlerts: React.FC = () => {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAlert, setEditingAlert] = useState<AlertType | null>(null);
  const [deletingAlertId, setDeletingAlertId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'warning' | 'success',
    active: true,
  });

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    const data = await getAlerts();
    setAlerts(data);
    setIsLoading(false);
  };

  const openCreateDialog = () => {
    setEditingAlert(null);
    setFormData({ title: '', message: '', type: 'info', active: true });
    setIsDialogOpen(true);
  };

  const openEditDialog = (alert: AlertType) => {
    setEditingAlert(alert);
    setFormData({
      title: alert.title,
      message: alert.message,
      type: alert.type,
      active: alert.active,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setDeletingAlertId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingAlert) {
        await updateAlert(editingAlert.id, formData);
        toast({ title: 'Alerta actualizada', description: 'Los cambios han sido guardados.' });
      } else {
        await createAlert(formData);
        toast({ title: 'Alerta creada', description: 'La nueva alerta ha sido añadida.' });
      }
      
      await fetchAlerts();
      setIsDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo guardar la alerta.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAlertId) return;
    
    try {
      await deleteAlert(deletingAlertId);
      toast({ title: 'Alerta eliminada', description: 'La alerta ha sido eliminada.' });
      await fetchAlerts();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar la alerta.', variant: 'destructive' });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingAlertId(null);
    }
  };

  const toggleActive = async (alert: AlertType) => {
    try {
      await updateAlert(alert.id, { active: !alert.active });
      await fetchAlerts();
      toast({ 
        title: alert.active ? 'Alerta desactivada' : 'Alerta activada',
        description: alert.active ? 'Los usuarios ya no verán esta alerta.' : 'Los usuarios verán esta alerta.'
      });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar la alerta.', variant: 'destructive' });
    }
  };

  const icons = {
    info: Info,
    warning: AlertTriangle,
    success: CheckCircle,
  };

  const styles = {
    info: 'bg-primary/10 border-primary/30 text-primary',
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500',
    success: 'bg-green-500/10 border-green-500/30 text-green-500',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Alertas</h1>
          <p className="text-muted-foreground mt-1">
            Crea alertas para mostrar a los usuarios.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva alerta
        </Button>
      </div>

      {/* Alerts List */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Alertas configuradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ListSkeleton count={3} />
          ) : alerts.length > 0 ? (
            <div className="space-y-4">
              {alerts.map((alert) => {
                const Icon = icons[alert.type];
                return (
                  <div 
                    key={alert.id}
                    className={cn(
                      'flex items-start gap-4 p-4 rounded-lg border',
                      alert.active ? styles[alert.type] : 'bg-secondary/50 border-border text-muted-foreground'
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-sm opacity-80">{alert.message}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={alert.active}
                        onCheckedChange={() => toggleActive(alert)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(alert)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(alert.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Bell}
              title="Sin alertas"
              description="Crea alertas para informar a tus clientes."
              action={{ label: 'Crear alerta', onClick: openCreateDialog }}
            />
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAlert ? 'Editar alerta' : 'Nueva alerta'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Título de la alerta"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Mensaje</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Mensaje de la alerta..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value: 'info' | 'warning' | 'success') => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-primary" />
                        Información
                      </div>
                    </SelectItem>
                    <SelectItem value="warning">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        Advertencia
                      </div>
                    </SelectItem>
                    <SelectItem value="success">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Éxito
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="active">Activa</Label>
                  <p className="text-sm text-muted-foreground">
                    Los usuarios verán esta alerta cuando esté activa.
                  </p>
                </div>
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingAlert ? 'Guardar cambios' : 'Crear alerta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar alerta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La alerta será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminAlerts;
