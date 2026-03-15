import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { Plus, Pencil, Trash2, Loader2, UserCircle, CalendarClock, Copy, ClipboardPaste, WandSparkles, MoreHorizontal } from 'lucide-react';
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
import { resolveBarberAccentColor } from '@/lib/barberColors';
import { useI18n } from '@/hooks/useI18n';
import { resolveDateLocale } from '@/lib/i18n';
import InlineTranslationPopover from '@/components/admin/InlineTranslationPopover';

const DAY_KEYS: DayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const SHIFT_KEYS = ['morning', 'afternoon'] as const;
type ShiftKey = (typeof SHIFT_KEYS)[number];
type ScheduleDialogTab = 'hours' | 'tolerance';

const SHIFT_LABEL_KEYS: Record<ShiftKey, { labelKey: string; hintKey: string }> = {
  morning: {
    labelKey: 'admin.barbers.shift.morning.label',
    hintKey: 'admin.barbers.shift.morning.hint',
  },
  afternoon: {
    labelKey: 'admin.barbers.shift.afternoon.label',
    hintKey: 'admin.barbers.shift.afternoon.hint',
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
  const { t, language } = useI18n();
  const dateLocale = resolveDateLocale(language);
  const { tenant, currentLocationId } = useTenant();
  const copy = useBusinessCopy();
  const dayLabels = useMemo(
    () =>
      DAY_KEYS.map((key) => ({
        key,
        label: t(`admin.barbers.day.${key}.label`),
        short: t(`admin.barbers.day.${key}.short`),
      })),
    [t],
  );
  const shiftLabels = useMemo(
    () =>
      (Object.entries(SHIFT_LABEL_KEYS) as Array<
        [ShiftKey, { labelKey: string; hintKey: string }]
      >).reduce(
        (acc, [key, value]) => {
          acc[key] = {
            label: t(value.labelKey),
            hint: t(value.hintKey),
          };
          return acc;
        },
        {} as Record<ShiftKey, { label: string; hint: string }>,
      ),
    [t],
  );
  const staffCompatibleLabel = copy.staff.isCollective
    ? t('admin.barbers.assignment.staffCompatibleSingular', {
        staffSingularLower: copy.staff.singularLower,
      })
    : t('admin.barbers.assignment.staffCompatiblePlural', {
        staffPluralLower: copy.staff.pluralLower,
      });
  const staffResetAvailabilityLabel = copy.staff.isCollective
    ? t('admin.barbers.assignment.resetAvailabilitySingular', {
        staffDefiniteSingular: copy.staff.definiteSingular,
      })
    : t('admin.barbers.assignment.resetAvailabilityPlural', {
        staffDefinitePlural: copy.staff.definitePlural,
      });
  const emptyStaffDescription = copy.staff.isCollective
    ? t('admin.barbers.empty.descriptionCollective')
    : t('admin.barbers.empty.descriptionPlural', {
        staffPluralLower: copy.staff.pluralLower,
      });
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
  const [savingColorByBarber, setSavingColorByBarber] = useState<Record<string, boolean>>({});
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
    queryKey: queryKeys.barbers(currentLocationId, undefined, true),
    enabled: Boolean(currentLocationId),
    queryFn: () => fetchBarbersCached({ localId: currentLocationId, includeInactive: true }),
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
    toast({
      title: t('admin.common.error'),
      description: t('admin.barbers.toast.loadStaffError'),
      variant: 'destructive',
    });
  }, [barbersQuery.error, t, toast]);

  useEffect(() => {
    if (!servicesQuery.error && !categoriesQuery.error && !settingsQuery.error) return;
    toast({
      title: t('admin.common.error'),
      description: t('admin.barbers.toast.loadAssignmentConfigError'),
      variant: 'destructive',
    });
  }, [categoriesQuery.error, servicesQuery.error, settingsQuery.error, t, toast]);

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

  const handleBarberCalendarColorChange = async (barber: Barber, nextColor: string) => {
    const normalized = nextColor.toLowerCase();
    if (barber.calendarColor?.toLowerCase() === normalized) return;
    setSavingColorByBarber((prev) => ({ ...prev, [barber.id]: true }));
    try {
      await updateBarber(barber.id, { calendarColor: normalized });
      await barbersQuery.refetch();
      dispatchBarbersUpdated({ source: 'admin-barbers' });
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.barbers.toast.updateCalendarColorError'),
        variant: 'destructive',
      });
    } finally {
      setSavingColorByBarber((prev) => ({ ...prev, [barber.id]: false }));
    }
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
      toast({
        title: t('admin.common.error'),
        description: t('admin.barbers.toast.loadScheduleError'),
        variant: 'destructive',
      });
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
        title: t('admin.barbers.toast.assignmentsSavedTitle'),
        description: t('admin.barbers.toast.assignmentsSavedDescription', {
          staffFromWithDefinite: copy.staff.fromWithDefinite,
        }),
      });
      closeAssignmentDialog();
    } catch (error) {
      toast({
        title: t('admin.barbers.toast.saveErrorTitle'),
        description:
          error instanceof Error ? error.message : t('admin.barbers.toast.assignmentReviewSelections'),
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
        title: enabled
          ? t('admin.barbers.toast.assignmentEnabledTitle')
          : t('admin.barbers.toast.assignmentDisabledTitle'),
        description: enabled
          ? t('admin.barbers.toast.assignmentEnabledDescription', {
              staffCompatibleLabel,
            })
          : staffResetAvailabilityLabel,
      });
    } catch (error) {
      toast({
        title: t('admin.barbers.toast.updateErrorTitle'),
        description: error instanceof Error ? error.message : t('admin.common.tryAgainInSeconds'),
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
    DAY_KEYS.reduce((acc, day) => {
      const value = current?.[day];
      if (typeof value === 'number' && Number.isFinite(value)) {
        acc[day] = Math.max(0, Math.floor(value));
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
      toast({
        title: t('admin.barbers.toast.scheduleCopiedTitle'),
        description: t('admin.barbers.toast.scheduleCopiedDescription', {
          staffSingularLower: copy.staff.singularLower,
        }),
      });
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
      toast({
        title: t('admin.barbers.toast.scheduleAppliedTitle'),
        description: t('admin.barbers.toast.scheduleAppliedDescription'),
      });
    } catch {
      toast({
        title: t('admin.common.error'),
        description: t('admin.barbers.toast.copyScheduleError'),
        variant: 'destructive',
      });
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
      toast({
        title: t('admin.barbers.toast.scheduleSavedTitle'),
        description: t('admin.barbers.toast.scheduleSavedDescription', {
          staffFromWithDefinite: copy.staff.fromWithDefinite,
        }),
      });
      closeScheduleDialog();
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.barbers.toast.saveScheduleError'),
        variant: 'destructive',
      });
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
              title: t('admin.common.warning'),
              description: t('admin.barbers.toast.cleanupPreviousPhotoError'),
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
              title: t('admin.common.warning'),
              description: t('admin.barbers.toast.cleanupPreviousPhotoError'),
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
        toast({
          title: t('admin.barbers.toast.staffUpdatedTitle', {
            staffSingular: copy.staff.singular,
          }),
          description: t('admin.barbers.toast.changesSavedDescription'),
        });
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
        toast({
          title: t('admin.barbers.toast.staffAddedTitle', {
            staffSingular: copy.staff.singular,
          }),
          description: t('admin.barbers.toast.staffAddedDescription', {
            staffSingularLower: copy.staff.singularLower,
          }),
        });
      }
      
      await barbersQuery.refetch();
      dispatchBarbersUpdated({ source: 'admin-barbers' });
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.barbers.toast.saveStaffError', {
          staffDefiniteSingular: copy.staff.definiteSingular,
        }),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingBarberId) return;
    
    try {
      await deleteBarber(deletingBarberId);
      toast({
        title: t('admin.barbers.toast.staffDeletedTitle', {
          staffSingular: copy.staff.singular,
        }),
        description: t('admin.barbers.toast.staffDeletedDescription', {
          staffDefiniteSingular: copy.staff.definiteSingular,
        }),
      });
      await barbersQuery.refetch();
      dispatchBarbersUpdated({ source: 'admin-barbers' });
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.barbers.toast.deleteStaffError', {
          staffDefiniteSingular: copy.staff.definiteSingular,
        }),
        variant: 'destructive',
      });
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
            {t('admin.barbers.subtitle')}
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          {t('admin.barbers.actions.newStaff', { staffSingularLower: copy.staff.singularLower })}
        </Button>
      </div>

      {assignmentFeatureVisible && (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="text-base">
              {t('admin.barbers.assignment.title', { staffSingularLower: copy.staff.singularLower })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="font-medium text-sm text-foreground">
                  {t('admin.barbers.assignment.enableRules')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('admin.barbers.assignment.enableRulesHint', { staffCompatibleLabel })}
                </p>
              </div>
              <Switch
                checked={assignmentEnabled}
                disabled={!settings || isSavingSettings || isMetaLoading}
                onCheckedChange={handleToggleAssignmentMode}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('admin.barbers.assignment.autoRule', { staffIndefiniteSingular: copy.staff.indefiniteSingular })}
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
              <CardContent className="admin-barber-card-content p-6">
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
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="h-4 w-4 shrink-0 aspect-square rounded-full border border-white/30 shadow-sm transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                            style={{ backgroundColor: resolveBarberAccentColor(barber.id, barber.calendarColor) }}
                            onClick={() => {
                              const input = document.getElementById(`barber-calendar-color-${barber.id}`) as HTMLInputElement | null;
                              input?.click();
                            }}
                            title={t('admin.barbers.calendarColor.title')}
                            aria-label={t('admin.barbers.calendarColor.ariaLabel', { barberName: barber.name })}
                          />
                          <input
                            id={`barber-calendar-color-${barber.id}`}
                            type="color"
                            className="sr-only"
                            value={resolveBarberAccentColor(barber.id, barber.calendarColor)}
                            onChange={(event) => void handleBarberCalendarColorChange(barber, event.target.value)}
                            disabled={Boolean(savingColorByBarber[barber.id])}
                          />
                          <h3 className="font-semibold text-foreground text-lg">{barber.name}</h3>
                          {savingColorByBarber[barber.id] && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                        </div>
                        <p className="text-sm text-primary">{barber.specialty}</p>
                      </div>
                      <div className="hidden sm:flex gap-1">
                        <TooltipProvider delayDuration={150}>
                          {assignmentFeatureVisible && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => openAssignmentDialog(barber)}>
                                  <WandSparkles className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('admin.barbers.actions.assignServices')}</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => openScheduleDialog(barber)}>
                                <CalendarClock className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('admin.barbers.actions.editSchedule')}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(barber)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('admin.barbers.actions.editProfile')}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(barber.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('admin.roles.actions.delete')}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="sm:hidden">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {assignmentFeatureVisible && (
                              <DropdownMenuItem onClick={() => openAssignmentDialog(barber)}>
                              <WandSparkles className="mr-2 w-4 h-4" />
                                {t('admin.barbers.actions.assignServices')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openScheduleDialog(barber)}>
                              <CalendarClock className="mr-2 w-4 h-4" />
                              {t('admin.barbers.actions.editSchedule')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(barber)}>
                              <Pencil className="mr-2 w-4 h-4" />
                              {t('admin.barbers.actions.editProfile')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => openDeleteDialog(barber.id)}
                            >
                              <Trash2 className="mr-2 w-4 h-4" />
                              {t('admin.roles.actions.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        barber.isActive === false
                          ? 'bg-rose-500/10 text-rose-400'
                          : 'bg-green-500/10 text-green-400'
                      }`}>
                        {barber.isActive === false
                          ? t('admin.barbers.status.hidden')
                          : t('admin.barbers.status.active')}
                      </span>
                      {assignmentFeatureVisible && assignmentEnabled && (
                        <span className="text-xs text-muted-foreground">
                          {!barber.hasAnyServiceAssignment
                            ? t('admin.barbers.assignment.noAssignments')
                            : t('admin.barbers.assignment.summary', {
                                services: barber.assignedServiceIds?.length ?? 0,
                                categories: barber.assignedCategoryIds?.length ?? 0,
                              })}
                        </span>
                      )}
                    </div>
                    {barber.bio && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{barber.bio}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('admin.barbers.dates.start', {
                        date: barber.startDate
                          ? format(parseISO(barber.startDate), 'd MMM yyyy', { locale: dateLocale })
                          : t('admin.barbers.dates.undefined'),
                      })}
                      {barber.endDate &&
                        t('admin.barbers.dates.end', {
                          date: format(parseISO(barber.endDate), 'd MMM yyyy', { locale: dateLocale }),
                        })}
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
          title={t('admin.barbers.empty.title', { staffPluralLower: copy.staff.pluralLower })}
          description={emptyStaffDescription}
          action={{
            label: t('admin.barbers.actions.addStaff', { staffSingularLower: copy.staff.singularLower }),
            onClick: openCreateDialog,
          }}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBarber
                ? t('admin.barbers.dialog.editTitle', { staffSingularLower: copy.staff.singularLower })
                : t('admin.barbers.dialog.newTitle', { staffSingularLower: copy.staff.singularLower })}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('admin.barbers.dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="name">{t('admin.barbers.fields.name')}</Label>
                  <InlineTranslationPopover
                    entityType="barber"
                    entityId={editingBarber?.id}
                    fieldKey="name"
                    onUpdated={async () => {
                      await barbersQuery.refetch();
                    }}
                  />
                </div>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('admin.barbers.fields.namePlaceholder')}
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
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="specialty">{t('admin.barbers.fields.specialty')}</Label>
                  <InlineTranslationPopover
                    entityType="barber"
                    entityId={editingBarber?.id}
                    fieldKey="specialty"
                    onUpdated={async () => {
                      await barbersQuery.refetch();
                    }}
                  />
                </div>
                <Input
                  id="specialty"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  placeholder={t('admin.barbers.fields.specialtyPlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="bio">{t('admin.barbers.fields.bio')}</Label>
                  <InlineTranslationPopover
                    entityType="barber"
                    entityId={editingBarber?.id}
                    fieldKey="bio"
                    onUpdated={async () => {
                      await barbersQuery.refetch();
                    }}
                  />
                </div>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder={t('admin.barbers.fields.bioPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.barbers.fields.visibleForClients')}</Label>
                <div className="flex items-center justify-between rounded-lg border p-2">
                  <span className="text-sm text-muted-foreground">{t('admin.barbers.fields.visibleHint')}</span>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">{t('admin.barbers.fields.startDate')}</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">{t('admin.barbers.fields.endDate')}</Label>
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
                {t('appointmentEditor.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingBarber
                  ? t('admin.services.actions.saveChanges')
                  : t('admin.barbers.actions.addStaff', { staffSingularLower: copy.staff.singularLower })}
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
              {t('admin.barbers.assignment.dialogTitle', { barberName: assignmentDialog.barber?.name ?? '' })}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('admin.barbers.assignment.dialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              {!assignmentForm.serviceIds.length && !assignmentForm.categoryIds.length
                ? t('admin.barbers.assignment.noAssignmentsExplicit', {
                    staffDefiniteSingular: copy.staff.definiteSingular,
                  })
                : t('admin.barbers.assignment.currentAssignments', {
                    services: assignmentForm.serviceIds.length,
                    categories: assignmentForm.categoryIds.length,
                  })}
            </div>

            <div className="space-y-3">
              <Label className="text-sm">{t('admin.barbers.assignment.fullCategories')}</Label>
              {orderedCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('admin.barbers.assignment.noCategories', {
                    locationDefiniteSingular: copy.location.definiteSingular,
                  })}
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
                          {t('admin.barbers.assignment.servicesCount', {
                            count: servicesByCategory[category.id]?.length ?? 0,
                          })}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-sm">{t('admin.barbers.assignment.individualServices')}</Label>
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('admin.barbers.assignment.noServices')}</p>
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
                      <p className="text-sm font-medium text-foreground">{t('admin.services.uncategorized')}</p>
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
                {t('appointmentEditor.cancel')}
              </Button>
              <Button onClick={handleSaveAssignment} disabled={isAssignmentSaving}>
                {isAssignmentSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('admin.barbers.actions.saveAssignments')}
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
              {t('admin.barbers.schedule.title', { barberName: scheduleDialog.barber?.name ?? '' })}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('admin.barbers.schedule.description')}
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
                    {t('admin.barbers.schedule.tabs.hours')}
                  </TabsTrigger>
                  <TabsTrigger value="tolerance" className="rounded-md px-3 py-1.5 text-xs sm:text-sm">
                    {t('admin.barbers.schedule.tabs.tolerance')}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="hours" className="mt-0 space-y-4">
                  <div className="flex flex-wrap gap-3 items-center">
                    <Button variant="outline" size="sm" onClick={handleCopySchedule}>
                      <Copy className="w-4 h-4 mr-2" />
                      {t('admin.barbers.actions.copySchedule')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePasteSchedule}
                      disabled={!copiedSchedule}
                    >
                      <ClipboardPaste className="w-4 h-4 mr-2" />
                      {t('admin.barbers.actions.pasteSchedule')}
                    </Button>
                    <Select key={copySource} onValueChange={handleCopyFromBarber} disabled={otherBarbers.length === 0}>
                      <SelectTrigger className="w-full sm:w-64">
                        <SelectValue
                          placeholder={t('admin.barbers.actions.copyFromOther', {
                            staffSingularLower: copy.staff.singularLower,
                          })}
                        />
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
                    {dayLabels.map((day) => {
                      const dayData = scheduleForm[day.key];
                      return (
                        <div key={day.key} className="space-y-3 border rounded-2xl p-3 bg-muted/30">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <p className="font-semibold text-foreground">{day.label}</p>
                              <p className="text-xs text-muted-foreground">{t('admin.barbers.schedule.dayHint')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={!dayData.closed}
                                onCheckedChange={(checked) => handleScheduleClosed(day.key, !checked)}
                              />
                              <span className="text-xs text-muted-foreground">
                                {dayData.closed ? t('admin.barbers.schedule.closed') : t('admin.barbers.schedule.open')}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {SHIFT_KEYS.map((shiftKey) => {
                              const shift = dayData[shiftKey];
                              const info = shiftLabels[shiftKey];
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
                                        {shift.enabled
                                          ? t('admin.barbers.schedule.active')
                                          : t('admin.barbers.schedule.inactive')}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="grid sm:grid-cols-[repeat(2,minmax(140px,1fr))] gap-3 mt-2">
                                    <div className="space-y-1 w-full sm:max-w-[200px]">
                                      <Label className="text-xs text-muted-foreground">
                                        {t('admin.barbers.schedule.start')}
                                      </Label>
                                      <Input
                                        type="time"
                                        value={shift.start}
                                        disabled={dayData.closed || !shift.enabled}
                                        className="w-full sm:max-w-[200px]"
                                        onChange={(e) => handleShiftTimeChange(day.key, shiftKey, 'start', e.target.value)}
                                      />
                                    </div>
                                    <div className="space-y-1 w-full sm:max-w-[200px]">
                                      <Label className="text-xs text-muted-foreground">
                                        {t('admin.barbers.schedule.end')}
                                      </Label>
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
                        <Label className="text-sm">{t('admin.barbers.tolerance.endOfDayMinutes')}</Label>
                        <Input
                          type="number"
                          min={0}
                          step={5}
                          value={scheduleForm.endOverflowMinutes ?? ''}
                          onChange={(e) => handleEndOverflowMinutesChange(e.target.value)}
                          onFocus={(e) => e.currentTarget.select()}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('admin.barbers.tolerance.endOfDayHint', {
                            locationDefiniteSingular: copy.location.definiteSingular,
                          })}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground">{t('admin.barbers.tolerance.byDayTitle')}</p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {dayLabels.map((day) => (
                            <div key={`barber-overflow-${day.key}`} className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{day.short}</Label>
                              <Input
                                type="number"
                                min={0}
                                step={5}
                                value={scheduleForm.endOverflowByDay?.[day.key] ?? ''}
                                placeholder={t('admin.barbers.tolerance.inheritLocation')}
                                onChange={(e) => handleEndOverflowByDayChange(day.key, e.target.value)}
                                onFocus={(e) => e.currentTarget.select()}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground">{t('admin.barbers.tolerance.byDateTitle')}</p>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{t('admin.common.table.date')}</Label>
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
                            {t('admin.barbers.actions.addDate')}
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
                                  <Label className="text-xs text-muted-foreground">{t('admin.barbers.tolerance.minutes')}</Label>
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
                                  {t('admin.barbers.actions.remove')}
                                </Button>
                              </div>
                            ))}
                          {Object.keys(scheduleForm.endOverflowByDate ?? {}).length === 0 && (
                            <p className="text-xs text-muted-foreground">{t('admin.barbers.tolerance.noSpecificDates')}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeScheduleDialog}>
                  {t('appointmentEditor.cancel')}
                </Button>
                <Button onClick={handleSaveSchedule} disabled={isScheduleSaving}>
                  {isScheduleSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {t('admin.barbers.actions.saveSchedule')}
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
            <AlertDialogTitle>
              {t('admin.barbers.deleteDialog.title', { staffSingularLower: copy.staff.singularLower })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.barbers.deleteDialog.description', {
                staffDefiniteSingular: copy.staff.definiteSingular,
              })}
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

export default AdminBarbers;
