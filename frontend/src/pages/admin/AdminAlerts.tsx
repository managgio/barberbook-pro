import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { createAlert, deleteAlert, getAlerts, updateAlert } from '@/data/api/alerts';
import { Alert as AlertType } from '@/data/types';
import { Plus, Pencil, Trash2, Bell, Info, AlertTriangle, CheckCircle, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ListSkeleton } from '@/components/common/Skeleton';
import EmptyState from '@/components/common/EmptyState';
import { cn } from '@/lib/utils';
import { dispatchAlertsUpdated } from '@/lib/adminEvents';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenant } from '@/context/TenantContext';
import { useForegroundRefresh } from '@/hooks/useForegroundRefresh';
import { useI18n } from '@/hooks/useI18n';
import InlineTranslationPopover from '@/components/admin/InlineTranslationPopover';

const EMPTY_ALERTS: AlertType[] = [];

const AdminAlerts: React.FC = () => {
  const { toast } = useToast();
  const { t } = useI18n();
  const { currentLocationId } = useTenant();
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
    hasSchedule: false,
    startDate: '',
    endDate: '',
  });
  const alertsQuery = useQuery({
    queryKey: queryKeys.adminAlerts(currentLocationId),
    queryFn: getAlerts,
  });
  const alerts = React.useMemo(() => alertsQuery.data ?? EMPTY_ALERTS, [alertsQuery.data]);
  const isLoading = alertsQuery.isLoading;

  useEffect(() => {
    if (!alertsQuery.error) return;
    toast({
      title: t('admin.common.error'),
      description: t('admin.alerts.toast.loadError'),
      variant: 'destructive',
    });
  }, [alertsQuery.error, t, toast]);

  useForegroundRefresh(() => {
    void alertsQuery.refetch();
  });

  const openCreateDialog = () => {
    setEditingAlert(null);
    setFormData({ title: '', message: '', type: 'info', active: true, hasSchedule: false, startDate: '', endDate: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (alert: AlertType) => {
    setEditingAlert(alert);
    setFormData({
      title: alert.title,
      message: alert.message,
      type: alert.type,
      active: alert.active,
      hasSchedule: !!(alert.startDate || alert.endDate),
      startDate: alert.startDate ? alert.startDate.slice(0, 10) : '',
      endDate: alert.endDate ? alert.endDate.slice(0, 10) : '',
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
      if (formData.hasSchedule && formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
        toast({
          title: t('admin.alerts.toast.invalidDateRangeTitle'),
          description: t('admin.alerts.toast.invalidDateRangeDescription'),
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      if (editingAlert) {
        await updateAlert(editingAlert.id, {
          title: formData.title,
          message: formData.message,
          type: formData.type,
          active: formData.active,
          startDate: formData.hasSchedule ? formData.startDate || undefined : null,
          endDate: formData.hasSchedule ? formData.endDate || undefined : null,
        });
        toast({
          title: t('admin.alerts.toast.updatedTitle'),
          description: t('admin.services.toast.changesSavedDescription'),
        });
      } else {
        await createAlert({
          title: formData.title,
          message: formData.message,
          type: formData.type,
          active: formData.active,
          startDate: formData.hasSchedule ? formData.startDate || undefined : undefined,
          endDate: formData.hasSchedule ? formData.endDate || undefined : undefined,
        });
        toast({
          title: t('admin.alerts.toast.createdTitle'),
          description: t('admin.alerts.toast.createdDescription'),
        });
      }
      dispatchAlertsUpdated({ source: 'admin-alerts' });
      await alertsQuery.refetch();
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.alerts.toast.saveError'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAlertId) return;
    
    try {
      await deleteAlert(deletingAlertId);
      toast({
        title: t('admin.alerts.toast.deletedTitle'),
        description: t('admin.alerts.toast.deletedDescription'),
      });
      dispatchAlertsUpdated({ source: 'admin-alerts' });
      await alertsQuery.refetch();
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.alerts.toast.deleteError'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingAlertId(null);
    }
  };

  const toggleActive = async (alert: AlertType) => {
    try {
      await updateAlert(alert.id, { active: !alert.active });
      dispatchAlertsUpdated({ source: 'admin-alerts' });
      await alertsQuery.refetch();
      toast({ 
        title: alert.active
          ? t('admin.alerts.toast.deactivatedTitle')
          : t('admin.alerts.toast.activatedTitle'),
        description: alert.active
          ? t('admin.alerts.toast.deactivatedDescription')
          : t('admin.alerts.toast.activatedDescription')
      });
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.alerts.toast.updateError'),
        variant: 'destructive',
      });
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
        <div className="pl-12 md:pl-0">
          <h1 className="text-3xl font-bold text-foreground">{t('admin.alerts.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('admin.alerts.subtitle')}
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          {t('admin.alerts.actions.newAlert')}
        </Button>
      </div>

      {/* Alerts List */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            {t('admin.alerts.configuredTitle')}
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
                      {(alert.startDate || alert.endDate) && (
                        <div className="text-[11px] text-muted-foreground bg-background/50 border border-border rounded-full px-2 py-1">
                          {alert.startDate
                            ? t('admin.alerts.schedule.start', { date: alert.startDate.slice(0, 10) })
                            : t('admin.alerts.schedule.noStart')}{' '}
                          ·{' '}
                          {alert.endDate
                            ? t('admin.alerts.schedule.end', { date: alert.endDate.slice(0, 10) })
                            : t('admin.alerts.schedule.noEnd')}
                        </div>
                      )}
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
              title={t('admin.alerts.emptyTitle')}
              description={t('admin.alerts.emptyDescription')}
              action={{ label: t('admin.alerts.actions.createAlert'), onClick: openCreateDialog }}
            />
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAlert ? t('admin.alerts.dialog.editTitle') : t('admin.alerts.dialog.newTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('admin.alerts.dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="title">{t('admin.alerts.fields.title')}</Label>
                  <InlineTranslationPopover
                    entityType="alert"
                    entityId={editingAlert?.id}
                    fieldKey="title"
                    onUpdated={async () => {
                      await alertsQuery.refetch();
                    }}
                  />
                </div>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('admin.alerts.fields.titlePlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="message">{t('admin.alerts.fields.message')}</Label>
                  <InlineTranslationPopover
                    entityType="alert"
                    entityId={editingAlert?.id}
                    fieldKey="message"
                    onUpdated={async () => {
                      await alertsQuery.refetch();
                    }}
                  />
                </div>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder={t('admin.alerts.fields.messagePlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">{t('admin.alerts.fields.type')}</Label>
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
                        {t('admin.alerts.type.info')}
                      </div>
                    </SelectItem>
                    <SelectItem value="warning">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        {t('admin.alerts.type.warning')}
                      </div>
                    </SelectItem>
                    <SelectItem value="success">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        {t('admin.alerts.type.success')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="active">{t('admin.alerts.fields.active')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('admin.alerts.fields.activeHint')}
                  </p>
                </div>
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
              </div>
              <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      {t('admin.alerts.fields.scheduleByDates')}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t('admin.alerts.fields.scheduleHint')}
                    </p>
                  </div>
                  <Switch
                    checked={formData.hasSchedule}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        hasSchedule: checked,
                        startDate: checked ? prev.startDate : '',
                        endDate: checked ? prev.endDate : '',
                      }))
                    }
                  />
                </div>
                {formData.hasSchedule && (
                  <div className="grid sm:grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1">
                      <Label>{t('admin.alerts.fields.start')}</Label>
                      <Input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('admin.alerts.fields.end')}</Label>
                      <Input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('appointmentEditor.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingAlert ? t('admin.services.actions.saveChanges') : t('admin.alerts.actions.createAlert')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.alerts.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.alerts.deleteDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('appointmentEditor.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('admin.roles.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminAlerts;
