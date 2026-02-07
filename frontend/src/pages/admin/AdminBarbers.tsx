import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  createBarber,
  deleteBarber,
  getBarberSchedule,
  updateBarber,
  updateBarberSchedule,
  updateBarberServiceAssignment,
} from '@/data/api/barbers';
import { updateSiteSettings } from '@/data/api/settings';
import { Barber, DayKey, Service, ServiceCategory, ShopSchedule } from '@/data/types';
import { Plus, Pencil, Trash2, Loader2, UserCircle, CalendarClock, Copy, ClipboardPaste, WandSparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { dispatchBarbersUpdated, dispatchSchedulesUpdated, dispatchSiteSettingsUpdated } from '@/lib/adminEvents';
import { CardSkeleton } from '@/components/common/Skeleton';
import EmptyState from '@/components/common/EmptyState';
import { useTenant } from '@/context/TenantContext';
import { BarberPhotoUploader, PhotoChangePayload, cropAndCompress } from '@/components/admin/BarberPhotoUploader';
import defaultAvatar from '@/assets/img/default-image.webp';
import { deleteFromImageKit, uploadToImageKit } from '@/lib/imagekit';
import { useBusinessCopy } from '@/lib/businessCopy';
import { fetchSiteSettingsCached } from '@/lib/siteSettingsQuery';
import { fetchBarbersCached, fetchServiceCategoriesCached, fetchServicesCached } from '@/lib/catalogQuery';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

const DAY_LABELS: { key: DayKey; label: string; short: string }[] = [
  { key: 'monday', label: 'Lunes', short: 'Lun' },
  { key: 'tuesday', label: 'Martes', short: 'Mar' },
  { key: 'wednesday', label: 'Miércoles', short: 'Mié' },
  { key: 'thursday', label: 'Jueves', short: 'Jue' },
  { key: 'friday', label: 'Viernes', short: 'Vie' },
  { key: 'saturday', label: 'Sábado', short: 'Sáb' },
  { key: 'sunday', label: 'Domingo', short: 'Dom' },
];

const SHIFT_KEYS = ['morning', 'afternoon'] as const;
type ShiftKey = (typeof SHIFT_KEYS)[number];
type ScheduleDialogTab = 'hours' | 'tolerance';

const SHIFT_LABELS: Record<ShiftKey, { label: string; hint: string }> = {
  morning: {
    label: 'Turno de mañana',
    hint: 'Configura el bloque matutino.',
  },
  afternoon: {
    label: 'Turno de tarde',
    hint: 'Configura el bloque vespertino.',
  },
};

const cloneSchedule = (schedule: ShopSchedule) => JSON.parse(JSON.stringify(schedule)) as ShopSchedule;
const normalizeIds = (ids?: string[]) =>
  Array.from(new Set((ids || []).filter((id): id is string => Boolean(id))));
const EMPTY_BARBERS: Barber[] = [];
const EMPTY_SERVICES: Service[] = [];
const EMPTY_CATEGORIES: ServiceCategory[] = [];

const AdminBarbers: React.FC = () => {
  const { toast } = useToast();
  const { tenant, currentLocationId } = useTenant();
  const copy = useBusinessCopy();
  const staffCompatibleLabel = copy.staff.isCollective
    ? `${copy.staff.singularLower} compatible`
    : `${copy.staff.pluralLower} compatibles`;
  const staffResetAvailabilityLabel = copy.staff.isCollective
    ? `${copy.staff.definiteSingular} volverá a estar disponible para cualquier servicio.`
    : `${copy.staff.definitePlural} volverán a estar disponibles para cualquier servicio.`;
  const emptyStaffDescription = copy.staff.isCollective
    ? 'Añade miembros del equipo para gestionar la agenda.'
    : `Añade ${copy.staff.pluralLower} para gestionar el equipo.`;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null);
  const [deletingBarberId, setDeletingBarberId] = useState<string | null>(null);
  const [scheduleDialog, setScheduleDialog] = useState<{ open: boolean; barber: Barber | null }>({ open: false, barber: null });
  const [scheduleForm, setScheduleForm] = useState<ShopSchedule | null>(null);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [isScheduleSaving, setIsScheduleSaving] = useState(false);
  const [assignmentDialog, setAssignmentDialog] = useState<{ open: boolean; barber: Barber | null }>({
    open: false,
    barber: null,
  });
  const [assignmentForm, setAssignmentForm] = useState<{ serviceIds: string[]; categoryIds: string[] }>({
    serviceIds: [],
    categoryIds: [],
  });
  const [isAssignmentSaving, setIsAssignmentSaving] = useState(false);
  const [scheduleCache, setScheduleCache] = useState<Record<string, ShopSchedule>>({});
  const [copiedSchedule, setCopiedSchedule] = useState<ShopSchedule | null>(null);
  const [copySource, setCopySource] = useState(0);
  const [scheduleActiveTab, setScheduleActiveTab] = useState<ScheduleDialogTab>('hours');
  const [newScheduleOverflowDate, setNewScheduleOverflowDate] = useState('');
  const todayISO = new Date().toISOString().split('T')[0];
  const [pendingPhoto, setPendingPhoto] = useState<{ dataUrl: string; zoom: number } | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [originalPhotoFileId, setOriginalPhotoFileId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    photo: defaultAvatar,
    photoFileId: null as string | null,
    specialty: '',
    bio: '',
    startDate: todayISO,
    endDate: '',
    isActive: true,
  });
  const barbersQuery = useQuery({
    queryKey: queryKeys.barbers(currentLocationId),
    enabled: Boolean(currentLocationId),
    queryFn: () => fetchBarbersCached({ localId: currentLocationId }),
  });
  const servicesQuery = useQuery({
    queryKey: queryKeys.services(currentLocationId),
    enabled: Boolean(currentLocationId),
    queryFn: () => fetchServicesCached({ localId: currentLocationId }),
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.serviceCategories(currentLocationId),
    enabled: Boolean(currentLocationId),
    queryFn: () => fetchServiceCategoriesCached({ localId: currentLocationId }),
  });
  const settingsQuery = useQuery({
    queryKey: queryKeys.siteSettings(currentLocationId),
    enabled: Boolean(currentLocationId),
    queryFn: () => fetchSiteSettingsCached(currentLocationId),
  });
  const barbers = useMemo(
    () => barbersQuery.data ?? EMPTY_BARBERS,
    [barbersQuery.data],
  );
  const services = useMemo(
    () => servicesQuery.data ?? EMPTY_SERVICES,
    [servicesQuery.data],
  );
  const categories = useMemo(
    () => categoriesQuery.data ?? EMPTY_CATEGORIES,
    [categoriesQuery.data],
  );
  const settings = settingsQuery.data ?? null;
  const isLoading = barbersQuery.isLoading;
  const isMetaLoading = servicesQuery.isLoading || categoriesQuery.isLoading || settingsQuery.isLoading;

  useEffect(() => {
    if (!barbersQuery.error) return;
    toast({ title: 'Error', description: 'No se pudo cargar el equipo.', variant: 'destructive' });
  }, [barbersQuery.error, toast]);

  useEffect(() => {
    if (!servicesQuery.error && !categoriesQuery.error && !settingsQuery.error) return;
    toast({
      title: 'Error',
      description: 'No se pudo cargar la configuración de asignaciones.',
      variant: 'destructive',
    });
  }, [categoriesQuery.error, servicesQuery.error, settingsQuery.error, toast]);

  const openCreateDialog = () => {
    setEditingBarber(null);
    setFormData({ name: '', photo: defaultAvatar, photoFileId: null, specialty: '', bio: '', startDate: todayISO, endDate: '', isActive: true });
    setPendingPhoto(null);
    setRemovePhoto(false);
    setOriginalPhotoFileId(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (barber: Barber) => {
    setEditingBarber(barber);
    setFormData({
      name: barber.name,
      photo: barber.photo || defaultAvatar,
      photoFileId: barber.photoFileId || null,
      specialty: barber.specialty,
      bio: barber.bio || '',
      startDate: barber.startDate || todayISO,
      endDate: barber.endDate || '',
      isActive: barber.isActive ?? true,
    });
    setPendingPhoto(null);
    setRemovePhoto(false);
    setOriginalPhotoFileId(barber.photoFileId || null);
    setIsDialogOpen(true);
  };

  const handlePhotoChange = (change: PhotoChangePayload) => {
    setFormData((prev) => ({
      ...prev,
      photo: change.previewUrl,
      photoFileId: change.remove ? null : change.dataUrl ? null : prev.photoFileId,
    }));

    if (change.remove) {
      setPendingPhoto(null);
      setRemovePhoto(true);
      return;
    }

    if (change.dataUrl) {
      setPendingPhoto({ dataUrl: change.dataUrl, zoom: change.zoom ?? 1.05 });
      setRemovePhoto(false);
      return;
    }
  };

  const openDeleteDialog = (id: string) => {
    setDeletingBarberId(id);
    setIsDeleteDialogOpen(true);
  };

  const openScheduleDialog = async (barber: Barber) => {
    setScheduleDialog({ open: true, barber });
    setScheduleActiveTab('hours');
    setIsScheduleLoading(true);
    try {
      const existing = scheduleCache[barber.id];
      const schedule = existing || await getBarberSchedule(barber.id);
      if (!existing) {
        setScheduleCache(prev => ({ ...prev, [barber.id]: schedule }));
      }
      setScheduleForm(cloneSchedule(schedule));
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo cargar el horario.', variant: 'destructive' });
      setScheduleDialog({ open: false, barber: null });
    } finally {
      setIsScheduleLoading(false);
    }
  };

  const otherBarbers = useMemo(
    () => scheduleDialog.barber ? barbers.filter((b) => b.id !== scheduleDialog.barber?.id) : [],
    [barbers, scheduleDialog.barber]
  );

  const orderedCategories = useMemo(
    () =>
      [...categories].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name),
      ),
    [categories],
  );

  const servicesByCategory = useMemo(
    () =>
      orderedCategories.reduce<Record<string, Service[]>>((acc, category) => {
        acc[category.id] = services.filter((service) => service.categoryId === category.id);
        return acc;
      }, {}),
    [orderedCategories, services],
  );

  const uncategorizedServices = useMemo(
    () => services.filter((service) => !service.categoryId),
    [services],
  );

  const assignmentEnabled = settings?.services.barberServiceAssignmentEnabled ?? false;
  const assignmentFeatureVisible = tenant?.config?.features?.barberServiceAssignmentEnabled !== false;

  const closeScheduleDialog = () => {
    setScheduleDialog({ open: false, barber: null });
    setScheduleForm(null);
    setCopySource(0);
    setScheduleActiveTab('hours');
    setNewScheduleOverflowDate('');
    setIsScheduleLoading(false);
    setIsScheduleSaving(false);
  };

  const openAssignmentDialog = (barber: Barber) => {
    if (!assignmentFeatureVisible) return;
    setAssignmentDialog({ open: true, barber });
    setAssignmentForm({
      serviceIds: normalizeIds(barber.assignedServiceIds),
      categoryIds: normalizeIds(barber.assignedCategoryIds),
    });
  };

  const closeAssignmentDialog = () => {
    setAssignmentDialog({ open: false, barber: null });
    setAssignmentForm({ serviceIds: [], categoryIds: [] });
    setIsAssignmentSaving(false);
  };

  const toggleAssignedService = (serviceId: string, checked: boolean) => {
    setAssignmentForm((prev) => ({
      ...prev,
      serviceIds: checked
        ? normalizeIds([...prev.serviceIds, serviceId])
        : prev.serviceIds.filter((id) => id !== serviceId),
    }));
  };

  const toggleAssignedCategory = (categoryId: string, checked: boolean) => {
    setAssignmentForm((prev) => ({
      ...prev,
      categoryIds: checked
        ? normalizeIds([...prev.categoryIds, categoryId])
        : prev.categoryIds.filter((id) => id !== categoryId),
    }));
  };

  const handleSaveAssignment = async () => {
    if (!assignmentDialog.barber) return;
    setIsAssignmentSaving(true);
    try {
      await updateBarberServiceAssignment(assignmentDialog.barber.id, {
        serviceIds: normalizeIds(assignmentForm.serviceIds),
        categoryIds: normalizeIds(assignmentForm.categoryIds),
      });
      await barbersQuery.refetch();
      dispatchBarbersUpdated({ source: 'admin-barbers' });
      toast({
        title: 'Asignaciones guardadas',
        description: `La configuración ${copy.staff.fromWithDefinite} se ha actualizado.`,
      });
      closeAssignmentDialog();
    } catch (error) {
      toast({
        title: 'No se pudo guardar',
        description: error instanceof Error ? error.message : 'Revisa los servicios y categorías seleccionados.',
        variant: 'destructive',
      });
      setIsAssignmentSaving(false);
    }
  };

  const handleToggleAssignmentMode = async (enabled: boolean) => {
    if (!settings) return;
    setIsSavingSettings(true);
    try {
      const updated = await updateSiteSettings({
        ...settings,
        services: {
          ...settings.services,
          barberServiceAssignmentEnabled: enabled,
        },
      });
      await settingsQuery.refetch();
      dispatchSiteSettingsUpdated(updated);
      toast({
        title: enabled ? 'Asignación activada' : 'Asignación desactivada',
        description: enabled
          ? `Los clientes verán solo ${staffCompatibleLabel} con el servicio elegido.`
          : staffResetAvailabilityLabel,
      });
    } catch (error) {
      toast({
        title: 'No se pudo actualizar',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleShiftTimeChange = (
    day: DayKey,
    shift: ShiftKey,
    field: 'start' | 'end',
    value: string
  ) => {
    setScheduleForm(prev =>
      prev
        ? {
            ...prev,
            [day]: {
              ...prev[day],
              [shift]: {
                ...prev[day][shift],
                [field]: value,
              },
            },
          }
        : prev
    );
  };

  const handleShiftToggle = (day: DayKey, shift: ShiftKey, enabled: boolean) => {
    setScheduleForm(prev => {
      if (!prev) return prev;
      const updatedDay = {
        ...prev[day],
        [shift]: {
          ...prev[day][shift],
          enabled,
        },
      };
      if (enabled) {
        updatedDay.closed = false;
      } else if (!updatedDay.morning.enabled && !updatedDay.afternoon.enabled) {
        updatedDay.closed = true;
      }
      return {
        ...prev,
        [day]: updatedDay,
      };
    });
  };

  const handleScheduleClosed = (day: DayKey, closed: boolean) => {
    setScheduleForm(prev => {
      if (!prev) return prev;
      const updatedDay = {
        ...prev[day],
        closed,
      };
      if (!closed && !updatedDay.morning.enabled && !updatedDay.afternoon.enabled) {
        updatedDay.morning = { ...updatedDay.morning, enabled: true };
      }
      return {
        ...prev,
        [day]: updatedDay,
      };
    });
  };

  const handleEndOverflowMinutesChange = (value: string) => {
    setScheduleForm(prev => {
      if (!prev) return prev;
      if (value.trim() === '') {
        return { ...prev, endOverflowMinutes: undefined };
      }
      const parsed = Math.max(0, Math.floor(Number(value)));
      return { ...prev, endOverflowMinutes: Number.isFinite(parsed) ? parsed : undefined };
    });
  };

  const ensureEndOverflowByDay = (current?: Partial<Record<DayKey, number>>) =>
    DAY_LABELS.reduce((acc, day) => {
      const value = current?.[day.key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        acc[day.key] = Math.max(0, Math.floor(value));
      }
      return acc;
    }, {} as Partial<Record<DayKey, number>>);

  const ensureEndOverflowByDate = (current?: Record<string, number>) => {
    if (!current || typeof current !== 'object') return {};
    return Object.entries(current).reduce((acc, [dateKey, value]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return acc;
      if (typeof value !== 'number' || !Number.isFinite(value)) return acc;
      acc[dateKey] = Math.max(0, Math.floor(value));
      return acc;
    }, {} as Record<string, number>);
  };

  const handleEndOverflowByDayChange = (day: DayKey, value: string) => {
    setScheduleForm((prev) => {
      if (!prev) return prev;
      const byDay = ensureEndOverflowByDay(prev.endOverflowByDay);
      if (value.trim() === '') {
        delete byDay[day];
      } else {
        const parsed = Math.max(0, Math.floor(Number(value)));
        if (Number.isFinite(parsed)) {
          byDay[day] = parsed;
        }
      }
      return { ...prev, endOverflowByDay: byDay };
    });
  };

  const handleAddEndOverflowDate = (dateKey: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
    setScheduleForm((prev) => {
      if (!prev) return prev;
      const byDate = ensureEndOverflowByDate(prev.endOverflowByDate);
      if (byDate[dateKey] !== undefined) return prev;
      byDate[dateKey] = Math.max(0, Math.floor(prev.endOverflowMinutes ?? 0));
      return { ...prev, endOverflowByDate: byDate };
    });
  };

  const handleEndOverflowByDateChange = (dateKey: string, value: string) => {
    setScheduleForm((prev) => {
      if (!prev) return prev;
      const byDate = ensureEndOverflowByDate(prev.endOverflowByDate);
      if (value.trim() === '') {
        delete byDate[dateKey];
      } else {
        const parsed = Math.max(0, Math.floor(Number(value)));
        if (Number.isFinite(parsed)) {
          byDate[dateKey] = parsed;
        }
      }
      return { ...prev, endOverflowByDate: byDate };
    });
  };

  const handleRemoveEndOverflowDate = (dateKey: string) => {
    setScheduleForm((prev) => {
      if (!prev) return prev;
      const byDate = ensureEndOverflowByDate(prev.endOverflowByDate);
      delete byDate[dateKey];
      return { ...prev, endOverflowByDate: byDate };
    });
  };

  const handleCopySchedule = () => {
    if (scheduleForm) {
      setCopiedSchedule(cloneSchedule(scheduleForm));
    toast({ title: 'Horario copiado', description: `Ahora puedes pegarlo en otro ${copy.staff.singularLower}.` });
    }
  };

  const handlePasteSchedule = () => {
    if (copiedSchedule) {
      setScheduleForm(cloneSchedule(copiedSchedule));
    }
  };

  const handleCopyFromBarber = async (barberId: string) => {
    if (!barberId) return;
    try {
      const existing = scheduleCache[barberId];
      const schedule = existing || await getBarberSchedule(barberId);
      if (!existing) {
        setScheduleCache(prev => ({ ...prev, [barberId]: schedule }));
      }
      setScheduleForm(cloneSchedule(schedule));
      toast({ title: 'Horario aplicado', description: 'Se ha copiado el horario seleccionado.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo copiar el horario.', variant: 'destructive' });
    } finally {
      setCopySource(prev => prev + 1);
    }
  };

  const handleSaveSchedule = async () => {
    if (!scheduleDialog.barber || !scheduleForm) return;
    setIsScheduleSaving(true);
    try {
      const updated = await updateBarberSchedule(scheduleDialog.barber.id, scheduleForm);
      setScheduleCache(prev => ({ ...prev, [scheduleDialog.barber!.id]: updated }));
      dispatchSchedulesUpdated({ source: 'admin-barbers' });
    toast({ title: 'Horario guardado', description: `Se ha actualizado el horario ${copy.staff.fromWithDefinite}.` });
      closeScheduleDialog();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo guardar el horario.', variant: 'destructive' });
      setIsScheduleSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let updatedPhoto = formData.photo;
      let updatedPhotoFileId = formData.photoFileId;
      const previousFileId = originalPhotoFileId;
      if (removePhoto) {
        if (previousFileId) {
          try {
            await deleteFromImageKit(previousFileId);
          } catch (cleanupError) {
            console.error(cleanupError);
            toast({
              title: 'Aviso',
              description: 'No se pudo borrar la foto anterior. Revisa el almacenamiento.',
              variant: 'destructive',
            });
          }
        }
        updatedPhoto = defaultAvatar;
        updatedPhotoFileId = null;
      } else if (pendingPhoto) {
        const blob = await cropAndCompress(pendingPhoto.dataUrl, pendingPhoto.zoom);
        const fileName = `barber-${Date.now()}.webp`;
        const { url, fileId } = await uploadToImageKit(blob, fileName, 'barbers');
        updatedPhoto = url;
        updatedPhotoFileId = fileId;

        if (previousFileId && previousFileId !== fileId) {
          try {
            await deleteFromImageKit(previousFileId);
          } catch (cleanupError) {
            console.error(cleanupError);
            toast({
              title: 'Aviso',
              description: 'No se pudo borrar la foto anterior. Revisa el almacenamiento.',
              variant: 'destructive',
            });
          }
        }
      }

      if (editingBarber) {
        await updateBarber(editingBarber.id, {
          name: formData.name,
          photo: updatedPhoto,
          photoFileId: updatedPhotoFileId,
          specialty: formData.specialty,
          bio: formData.bio,
          role: 'worker',
          startDate: formData.startDate,
          endDate: formData.endDate ? formData.endDate : null,
          isActive: formData.isActive,
        });
        toast({ title: `${copy.staff.singular} actualizado`, description: 'Los cambios han sido guardados.' });
      } else {
        await createBarber({
          name: formData.name,
          photo: updatedPhoto,
          photoFileId: updatedPhotoFileId,
          specialty: formData.specialty,
          bio: formData.bio,
          role: 'worker',
          startDate: formData.startDate,
          endDate: formData.endDate ? formData.endDate : null,
          isActive: formData.isActive,
        });
        toast({ title: `${copy.staff.singular} añadido`, description: `El nuevo ${copy.staff.singularLower} ha sido añadido.` });
      }
      
      await barbersQuery.refetch();
      dispatchBarbersUpdated({ source: 'admin-barbers' });
      setIsDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: `No se pudo guardar ${copy.staff.definiteSingular}.`, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingBarberId) return;
    
    try {
      await deleteBarber(deletingBarberId);
      toast({ title: `${copy.staff.singular} eliminado`, description: `${copy.staff.definiteSingular} ha sido eliminado.` });
      await barbersQuery.refetch();
      dispatchBarbersUpdated({ source: 'admin-barbers' });
    } catch (error) {
      toast({ title: 'Error', description: `No se pudo eliminar ${copy.staff.definiteSingular}.`, variant: 'destructive' });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingBarberId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="pl-12 md:pl-0">
          <h1 className="text-3xl font-bold text-foreground">{copy.staff.plural}</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona el equipo y sus festivos.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo {copy.staff.singularLower}
        </Button>
      </div>

      {assignmentFeatureVisible && (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="text-base">Asignación de servicios por {copy.staff.singularLower}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="font-medium text-sm text-foreground">Activar reglas de asignación</p>
                <p className="text-xs text-muted-foreground">
                  Si está activo, en reservas solo aparecerán {staffCompatibleLabel} con el servicio elegido.
                </p>
              </div>
              <Switch
                checked={assignmentEnabled}
                disabled={!settings || isSavingSettings || isMetaLoading}
                onCheckedChange={handleToggleAssignmentMode}
              />
            </div>
            <p className="text-xs text-muted-foreground">
            Regla automática: si {copy.staff.indefiniteSingular} no tiene ninguna categoría ni servicio asignado, se considera disponible para todos los servicios.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Barbers Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : barbers.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {barbers.map((barber) => (
            <Card key={barber.id} variant="elevated">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <img 
                    src={barber.photo || defaultAvatar} 
                    alt={barber.name}
                    loading="lazy"
                    decoding="async"
                    width={96}
                    height={96}
                    className="w-24 h-24 rounded-xl object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground text-lg">{barber.name}</h3>
                        <p className="text-sm text-primary">{barber.specialty}</p>
                      </div>
                      <div className="flex gap-1">
                        {assignmentFeatureVisible && (
                          <Button variant="ghost" size="icon" onClick={() => openAssignmentDialog(barber)}>
                            <WandSparkles className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => openScheduleDialog(barber)}>
                          <CalendarClock className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(barber)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(barber.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        barber.isActive === false
                          ? 'bg-rose-500/10 text-rose-400'
                          : 'bg-green-500/10 text-green-400'
                      }`}>
                        {barber.isActive === false ? 'Oculto' : 'Activo'}
                      </span>
                      {assignmentFeatureVisible && assignmentEnabled && (
                        <span className="text-xs text-muted-foreground">
                          {!barber.hasAnyServiceAssignment
                            ? 'Sin asignaciones (atiende todos los servicios)'
                            : `${barber.assignedServiceIds?.length ?? 0} servicio(s) + ${barber.assignedCategoryIds?.length ?? 0} categoría(s)`}
                        </span>
                      )}
                    </div>
                    {barber.bio && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{barber.bio}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Inicio: {barber.startDate ? new Date(barber.startDate).toLocaleDateString() : 'Sin definir'}
                      {barber.endDate && ` · Fin: ${new Date(barber.endDate).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={UserCircle}
          title={`Sin ${copy.staff.pluralLower}`}
          description={emptyStaffDescription}
          action={{ label: `Añadir ${copy.staff.singularLower}`, onClick: openCreateDialog }}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBarber ? `Editar ${copy.staff.singularLower}` : `Nuevo ${copy.staff.singularLower}`}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Formulario para crear o editar profesionales del equipo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre completo"
                  required
                />
              </div>
              <div className="space-y-2">
                <BarberPhotoUploader
                  value={formData.photo}
                  onChange={handlePhotoChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialty">Especialidad</Label>
                <Input
                  id="specialty"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  placeholder="Ej: Cortes clásicos"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Biografía</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Breve descripción..."
                />
              </div>
              <div className="space-y-2">
                <Label>Visible para clientes</Label>
                <div className="flex items-center justify-between rounded-lg border p-2">
                  <span className="text-sm text-muted-foreground">Mostrar en el panel de reservas</span>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Fecha inicio</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Fecha fin (opcional)</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingBarber ? 'Guardar cambios' : `Añadir ${copy.staff.singularLower}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={assignmentFeatureVisible && assignmentDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            closeAssignmentDialog();
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Asignaciones de {assignmentDialog.barber?.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Configura qué servicios y categorías puede atender este profesional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              {!assignmentForm.serviceIds.length && !assignmentForm.categoryIds.length
                ? `Sin asignaciones explícitas: ${copy.staff.definiteSingular} estará disponible para todos los servicios.`
                : `Asignaciones actuales: ${assignmentForm.serviceIds.length} servicio(s) y ${assignmentForm.categoryIds.length} categoría(s).`}
            </div>

            <div className="space-y-3">
              <Label className="text-sm">Categorías completas</Label>
              {orderedCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay categorías creadas en {copy.location.definiteSingular}.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {orderedCategories.map((category) => (
                    <label
                      key={category.id}
                      className="flex items-center gap-3 rounded-xl border border-border px-3 py-2"
                    >
                      <Checkbox
                        checked={assignmentForm.categoryIds.includes(category.id)}
                        onCheckedChange={(checked) => toggleAssignedCategory(category.id, checked === true)}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{category.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {servicesByCategory[category.id]?.length ?? 0} servicio(s)
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-sm">Servicios individuales</Label>
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay servicios disponibles.</p>
              ) : (
                <div className="space-y-3">
                  {orderedCategories.map((category) => {
                    const items = servicesByCategory[category.id] || [];
                    if (items.length === 0) return null;
                    return (
                      <div key={category.id} className="rounded-xl border border-border p-3 space-y-2">
                        <p className="text-sm font-medium text-foreground">{category.name}</p>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {items.map((service) => (
                            <label
                              key={service.id}
                              className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2"
                            >
                              <Checkbox
                                checked={assignmentForm.serviceIds.includes(service.id)}
                                onCheckedChange={(checked) => toggleAssignedService(service.id, checked === true)}
                              />
                              <p className="text-sm text-foreground">{service.name}</p>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {uncategorizedServices.length > 0 && (
                    <div className="rounded-xl border border-border p-3 space-y-2">
                      <p className="text-sm font-medium text-foreground">Sin categoría</p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {uncategorizedServices.map((service) => (
                          <label
                            key={service.id}
                            className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2"
                          >
                            <Checkbox
                              checked={assignmentForm.serviceIds.includes(service.id)}
                              onCheckedChange={(checked) => toggleAssignedService(service.id, checked === true)}
                            />
                            <p className="text-sm text-foreground">{service.name}</p>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeAssignmentDialog}>
                Cancelar
              </Button>
              <Button onClick={handleSaveAssignment} disabled={isAssignmentSaving}>
                {isAssignmentSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Guardar asignaciones
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleDialog.open} onOpenChange={(open) => {
        if (!open) {
          closeScheduleDialog();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Horario de {scheduleDialog.barber?.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Ajusta horario semanal, descansos y tolerancia de cierre para este profesional.
            </DialogDescription>
          </DialogHeader>
          {isScheduleLoading || !scheduleForm ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <Tabs
                value={scheduleActiveTab}
                onValueChange={(value) => setScheduleActiveTab(value as ScheduleDialogTab)}
                className="space-y-4"
              >
                <TabsList className="inline-flex h-auto w-auto rounded-lg border border-border/60 bg-muted/30 p-1">
                  <TabsTrigger value="hours" className="rounded-md px-3 py-1.5 text-xs sm:text-sm">
                    Horario
                  </TabsTrigger>
                  <TabsTrigger value="tolerance" className="rounded-md px-3 py-1.5 text-xs sm:text-sm">
                    Tolerancia
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="hours" className="mt-0 space-y-4">
                  <div className="flex flex-wrap gap-3 items-center">
                    <Button variant="outline" size="sm" onClick={handleCopySchedule}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar horario
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePasteSchedule}
                      disabled={!copiedSchedule}
                    >
                      <ClipboardPaste className="w-4 h-4 mr-2" />
                      Pegar horario copiado
                    </Button>
                    <Select key={copySource} onValueChange={handleCopyFromBarber} disabled={otherBarbers.length === 0}>
                      <SelectTrigger className="w-full sm:w-64">
                        <SelectValue placeholder={`Copiar desde otro ${copy.staff.singularLower}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {otherBarbers.map((barber) => (
                          <SelectItem key={barber.id} value={barber.id}>
                            {barber.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    {DAY_LABELS.map((day) => {
                      const dayData = scheduleForm[day.key];
                      return (
                        <div key={day.key} className="space-y-3 border rounded-2xl p-3 bg-muted/30">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <p className="font-semibold text-foreground">{day.label}</p>
                              <p className="text-xs text-muted-foreground">Define turnos independientes para mañana y tarde.</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={!dayData.closed}
                                onCheckedChange={(checked) => handleScheduleClosed(day.key, !checked)}
                              />
                              <span className="text-xs text-muted-foreground">
                                {dayData.closed ? 'Cerrado' : 'Abierto'}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {SHIFT_KEYS.map((shiftKey) => {
                              const shift = dayData[shiftKey];
                              const info = SHIFT_LABELS[shiftKey];
                              return (
                                <div key={shiftKey} className="rounded-2xl border border-border/60 bg-background/40 p-2.5">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <div>
                                      <p className="font-medium text-sm text-foreground">{info.label}</p>
                                      <p className="text-xs text-muted-foreground">{info.hint}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Switch
                                        checked={shift.enabled}
                                        onCheckedChange={(checked) => handleShiftToggle(day.key, shiftKey, checked)}
                                        disabled={dayData.closed}
                                      />
                                      <span className="text-xs text-muted-foreground">
                                        {shift.enabled ? 'Activo' : 'Inactivo'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="grid sm:grid-cols-[repeat(2,minmax(140px,1fr))] gap-3 mt-2">
                                    <div className="space-y-1 w-full sm:max-w-[200px]">
                                      <Label className="text-xs text-muted-foreground">Inicio</Label>
                                      <Input
                                        type="time"
                                        value={shift.start}
                                        disabled={dayData.closed || !shift.enabled}
                                        className="w-full sm:max-w-[200px]"
                                        onChange={(e) => handleShiftTimeChange(day.key, shiftKey, 'start', e.target.value)}
                                      />
                                    </div>
                                    <div className="space-y-1 w-full sm:max-w-[200px]">
                                      <Label className="text-xs text-muted-foreground">Fin</Label>
                                      <Input
                                        type="time"
                                        value={shift.end}
                                        disabled={dayData.closed || !shift.enabled}
                                        className="w-full sm:max-w-[200px]"
                                        onChange={(e) => handleShiftTimeChange(day.key, shiftKey, 'end', e.target.value)}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="tolerance" className="mt-0">
                  <div className="rounded-2xl border border-border/60 bg-muted/30 p-3">
                    <div className="space-y-4">
                      <div className="space-y-2 max-w-xs">
                        <Label className="text-sm">Tolerancia fin de jornada (minutos)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={5}
                          value={scheduleForm.endOverflowMinutes ?? ''}
                          onChange={(e) => handleEndOverflowMinutesChange(e.target.value)}
                          onFocus={(e) => e.currentTarget.select()}
                        />
                        <p className="text-xs text-muted-foreground">
                          Si lo dejas vacío, se usa el valor configurado en {copy.location.definiteSingular}.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground">Ajuste por día de semana</p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {DAY_LABELS.map((day) => (
                            <div key={`barber-overflow-${day.key}`} className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{day.short}</Label>
                              <Input
                                type="number"
                                min={0}
                                step={5}
                                value={scheduleForm.endOverflowByDay?.[day.key] ?? ''}
                                placeholder="Hereda local"
                                onChange={(e) => handleEndOverflowByDayChange(day.key, e.target.value)}
                                onFocus={(e) => e.currentTarget.select()}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground">Ajuste por fecha concreta</p>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Fecha</Label>
                            <Input
                              type="date"
                              value={newScheduleOverflowDate}
                              onChange={(e) => setNewScheduleOverflowDate(e.target.value)}
                            />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              handleAddEndOverflowDate(newScheduleOverflowDate);
                              setNewScheduleOverflowDate('');
                            }}
                            disabled={!newScheduleOverflowDate}
                          >
                            Añadir fecha
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(scheduleForm.endOverflowByDate ?? {})
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([dateKey, value]) => (
                              <div
                                key={`barber-overflow-date-${dateKey}`}
                                className="grid grid-cols-[minmax(120px,1fr)_minmax(90px,130px)_auto] items-end gap-2 rounded-lg border border-border/60 bg-background/80 p-2"
                              >
                                <div>
                                  <p className="text-xs font-medium text-foreground">{dateKey}</p>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Minutos</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={5}
                                    value={value}
                                    onChange={(e) => handleEndOverflowByDateChange(dateKey, e.target.value)}
                                    onFocus={(e) => e.currentTarget.select()}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveEndOverflowDate(dateKey)}
                                >
                                  Quitar
                                </Button>
                              </div>
                            ))}
                          {Object.keys(scheduleForm.endOverflowByDate ?? {}).length === 0 && (
                            <p className="text-xs text-muted-foreground">Sin fechas específicas.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeScheduleDialog}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveSchedule} disabled={isScheduleSaving}>
                  {isScheduleSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Guardar horario
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {copy.staff.singularLower}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. {copy.staff.definiteSingular} será eliminado permanentemente.
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

export default AdminBarbers;
