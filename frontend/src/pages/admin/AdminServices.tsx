import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  createServiceCategory,
  deleteServiceCategory,
  updateServiceCategory,
} from '@/data/api/service-categories';
import { createService, deleteService, updateService } from '@/data/api/services';
import { updateSiteSettings } from '@/data/api/settings';
import { Service, ServiceCategory } from '@/data/types';
import { Plus, Pencil, Trash2, Scissors, Clock, Loader2, FolderTree, CheckCircle2, Sparkles, Percent, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CardSkeleton } from '@/components/common/Skeleton';
import EmptyState from '@/components/common/EmptyState';
import { Switch } from '@/components/ui/switch';
import { dispatchServicesUpdated, dispatchSiteSettingsUpdated } from '@/lib/adminEvents';
import { fetchSiteSettingsCached } from '@/lib/siteSettingsQuery';
import { fetchServiceCategoriesCached, fetchServicesCached } from '@/lib/catalogQuery';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useTenant } from '@/context/TenantContext';
import { useI18n } from '@/hooks/useI18n';
import InlineTranslationPopover from '@/components/admin/InlineTranslationPopover';
import { cn } from '@/lib/utils';

const UNCATEGORIZED_VALUE = 'none';
const EMPTY_SERVICES: Service[] = [];
const EMPTY_SERVICE_CATEGORIES: ServiceCategory[] = [];
const SERVICE_DRAG_MIME = 'application/x-service-id';
const CATEGORY_DRAG_MIME = 'application/x-service-category-id';

const reorderByInsertIndex = <T,>(items: T[], fromIndex: number, insertIndex: number): T[] => {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return items;
  let targetIndex = insertIndex;
  if (fromIndex < insertIndex) {
    targetIndex -= 1;
  }
  if (targetIndex < 0) targetIndex = 0;
  if (targetIndex > next.length) targetIndex = next.length;
  next.splice(targetIndex, 0, moved);
  return next;
};

const sortServices = (a: Service, b: Service) =>
  (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name);

const AdminServices: React.FC = () => {
  const { toast } = useToast();
  const { t } = useI18n();
  const { currentLocationId } = useTenant();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCategoryDeleteDialogOpen, setIsCategoryDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [isPersistingCategoryOrder, setIsPersistingCategoryOrder] = useState(false);
  const [isPersistingServiceOrder, setIsPersistingServiceOrder] = useState(false);
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);
  const [dragOverCategoryPosition, setDragOverCategoryPosition] = useState<'before' | 'after'>('before');
  const [draggingServiceId, setDraggingServiceId] = useState<string | null>(null);
  const [dragOverServiceId, setDragOverServiceId] = useState<string | null>(null);
  const [dragOverServiceColumnId, setDragOverServiceColumnId] = useState<string | null>(null);
  const [dragOverServicePosition, setDragOverServicePosition] = useState<'before' | 'after'>('before');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration: '',
    categoryId: UNCATEGORIZED_VALUE,
  });
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    position: 0,
  });
  const servicesQuery = useQuery({
    queryKey: queryKeys.services(currentLocationId),
    queryFn: () => fetchServicesCached({ localId: currentLocationId }),
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.serviceCategories(currentLocationId),
    queryFn: () => fetchServiceCategoriesCached({ localId: currentLocationId }),
  });
  const settingsQuery = useQuery({
    queryKey: queryKeys.siteSettings(currentLocationId),
    queryFn: () => fetchSiteSettingsCached(currentLocationId),
  });
  const services = useMemo(
    () => servicesQuery.data ?? EMPTY_SERVICES,
    [servicesQuery.data],
  );
  const categories = useMemo(
    () => categoriesQuery.data ?? EMPTY_SERVICE_CATEGORIES,
    [categoriesQuery.data],
  );
  const settings = settingsQuery.data ?? null;
  const isLoading = servicesQuery.isLoading || categoriesQuery.isLoading || settingsQuery.isLoading;
  const categoriesEnabled = settings?.services.categoriesEnabled ?? false;

  useEffect(() => {
    if (!servicesQuery.error && !categoriesQuery.error && !settingsQuery.error) return;
    toast({
      title: t('admin.common.error'),
      description: t('admin.services.toast.loadConfigError'),
      variant: 'destructive',
    });
  }, [categoriesQuery.error, servicesQuery.error, settingsQuery.error, t, toast]);

  const orderedCategories = useMemo(
    () =>
      [...categories].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name),
      ),
    [categories],
  );
  const orderedServices = useMemo(
    () => [...services].sort(sortServices),
    [services],
  );
  const uncategorizedServices = useMemo(
    () => orderedServices.filter((service) => !service.categoryId),
    [orderedServices],
  );
  const serviceColumns = useMemo(() => {
    if (!categoriesEnabled) {
      return [
        {
          id: UNCATEGORIZED_VALUE,
          name: t('admin.services.title'),
          description: t('admin.services.subtitle'),
          services: orderedServices,
          isUncategorized: true,
        },
      ];
    }

    const baseColumns = orderedCategories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description || t('admin.services.categories.noDescription'),
      services: orderedServices.filter((service) => service.categoryId === category.id),
      isUncategorized: false,
    }));

    if (uncategorizedServices.length > 0) {
      baseColumns.push({
        id: UNCATEGORIZED_VALUE,
        name: t('admin.services.uncategorized'),
        description: t('admin.services.presentation.uncategorizedWarning', { count: uncategorizedServices.length }),
        services: uncategorizedServices,
        isUncategorized: true,
      });
    }

    return baseColumns;
  }, [categoriesEnabled, orderedCategories, orderedServices, t, uncategorizedServices]);

  const getPriceDisplay = (service: Service) => {
    const finalPrice = service.finalPrice ?? service.price;
    const hasOffer = !!service.appliedOffer && Math.abs(finalPrice - service.price) > 0.001;
    return { finalPrice, hasOffer };
  };

  const openCreateDialog = () => {
    setEditingService(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      duration: '',
      categoryId: categoriesEnabled ? orderedCategories[0]?.id ?? UNCATEGORIZED_VALUE : UNCATEGORIZED_VALUE,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description,
      price: service.price.toString(),
      duration: service.duration.toString(),
      categoryId: service.categoryId || UNCATEGORIZED_VALUE,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setDeletingServiceId(id);
    setIsDeleteDialogOpen(true);
  };

  const openCategoryDialog = (category?: ServiceCategory) => {
    setEditingCategory(category || null);
    setCategoryForm({
      name: category?.name || '',
      description: category?.description || '',
      position: category?.position ?? categories.length,
    });
    setIsCategoryDialogOpen(true);
  };

  const openCategoryDeleteDialog = (id: string) => {
    setDeletingCategoryId(id);
    setIsCategoryDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const parsedDuration = parseInt(formData.duration, 10);
      const parsedPrice = parseFloat(formData.price);
      const categoryId = formData.categoryId === UNCATEGORIZED_VALUE ? null : formData.categoryId;
      const description = formData.description.trim();

      if (Number.isNaN(parsedDuration) || parsedDuration <= 0) {
        toast({
          title: t('admin.services.toast.invalidDurationTitle'),
          description: t('admin.services.toast.invalidDurationDescription'),
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        toast({
          title: t('admin.services.toast.invalidPriceTitle'),
          description: t('admin.services.toast.invalidPriceDescription'),
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      if (categoriesEnabled && !categoryId) {
        toast({
          title: t('admin.services.toast.missingCategoryTitle'),
          description: t('admin.services.toast.missingCategoryDescription'),
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      if (editingService) {
        await updateService(editingService.id, {
          name: formData.name,
          description,
          price: parsedPrice,
          duration: parsedDuration,
          categoryId,
        });
        toast({ title: t('admin.services.toast.serviceUpdatedTitle'), description: t('admin.services.toast.changesSavedDescription') });
      } else {
        await createService({
          name: formData.name,
          description,
          price: parsedPrice,
          duration: parsedDuration,
          categoryId,
        });
        toast({ title: t('admin.services.toast.serviceCreatedTitle'), description: t('admin.services.toast.serviceCreatedDescription') });
      }
      
      await Promise.all([
        servicesQuery.refetch(),
        categoriesQuery.refetch(),
      ]);
      dispatchServicesUpdated({ source: 'admin-services' });
      setIsDialogOpen(false);
    } catch (error) {
      toast({ title: t('admin.common.error'), description: t('admin.services.toast.saveServiceError'), variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCategorySubmitting(true);
    try {
      const payload = {
        name: categoryForm.name,
        description: categoryForm.description,
        position: Number(categoryForm.position) || 0,
      };
      if (editingCategory) {
        await updateServiceCategory(editingCategory.id, payload);
        toast({ title: t('admin.services.toast.categoryUpdatedTitle'), description: t('admin.services.toast.changesSavedDescription') });
      } else {
        await createServiceCategory(payload);
        toast({ title: t('admin.services.toast.categoryCreatedTitle'), description: t('admin.services.toast.categoryCreatedDescription') });
      }
      await Promise.all([
        servicesQuery.refetch(),
        categoriesQuery.refetch(),
      ]);
      dispatchServicesUpdated({ source: 'admin-services' });
      setIsCategoryDialogOpen(false);
    } catch (error) {
      toast({ title: t('admin.common.error'), description: t('admin.services.toast.saveCategoryError'), variant: 'destructive' });
    } finally {
      setIsCategorySubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingServiceId) return;
    
    try {
      await deleteService(deletingServiceId);
      toast({ title: t('admin.services.toast.serviceDeletedTitle'), description: t('admin.services.toast.serviceDeletedDescription') });
      await Promise.all([
        servicesQuery.refetch(),
        categoriesQuery.refetch(),
      ]);
      dispatchServicesUpdated({ source: 'admin-services' });
    } catch (error) {
      toast({ title: t('admin.common.error'), description: t('admin.services.toast.deleteServiceError'), variant: 'destructive' });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingServiceId(null);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategoryId) return;
    try {
      await deleteServiceCategory(deletingCategoryId);
      toast({ title: t('admin.services.toast.categoryDeletedTitle'), description: t('admin.services.toast.categoryDeletedDescription') });
      await Promise.all([
        servicesQuery.refetch(),
        categoriesQuery.refetch(),
      ]);
      dispatchServicesUpdated({ source: 'admin-services' });
    } catch (error) {
      toast({
        title: t('admin.services.toast.deleteErrorTitle'),
        description:
          error instanceof Error
            ? error.message
            : t('admin.services.toast.deleteCategoryHint'),
        variant: 'destructive',
      });
    } finally {
      setIsCategoryDeleteDialogOpen(false);
      setDeletingCategoryId(null);
    }
  };

  const buildServiceBuckets = (currentServices: Service[]) => {
    const sorted = [...currentServices].sort(sortServices);
    const buckets = new Map<string, Service[]>();

    if (!categoriesEnabled) {
      buckets.set(UNCATEGORIZED_VALUE, sorted);
      return buckets;
    }

    orderedCategories.forEach((category) => buckets.set(category.id, []));
    sorted.forEach((service) => {
      const key = service.categoryId ?? UNCATEGORIZED_VALUE;
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key)?.push(service);
    });
    return buckets;
  };

  const resetDragState = () => {
    setDraggingCategoryId(null);
    setDragOverCategoryId(null);
    setDragOverCategoryPosition('before');
    setDraggingServiceId(null);
    setDragOverServiceId(null);
    setDragOverServiceColumnId(null);
    setDragOverServicePosition('before');
  };

  const persistCategoryOrder = async (nextCategories: ServiceCategory[]) => {
    const updates = nextCategories
      .map((category, index) => ({ id: category.id, nextPosition: index, currentPosition: category.position ?? 0 }))
      .filter((entry) => entry.currentPosition !== entry.nextPosition)
      .map((entry) => updateServiceCategory(entry.id, { position: entry.nextPosition }));

    if (updates.length === 0) return;

    setIsPersistingCategoryOrder(true);
    try {
      await Promise.all(updates);
      await Promise.all([categoriesQuery.refetch(), servicesQuery.refetch()]);
      dispatchServicesUpdated({ source: 'admin-services' });
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.services.toast.saveCategoryError'),
        variant: 'destructive',
      });
    } finally {
      setIsPersistingCategoryOrder(false);
    }
  };

  const persistServiceDrop = async (serviceId: string, targetColumnId: string, targetIndex: number) => {
    const sourceService = services.find((service) => service.id === serviceId);
    if (!sourceService) return;

    if (categoriesEnabled && targetColumnId === UNCATEGORIZED_VALUE) {
      toast({
        title: t('admin.services.toast.missingCategoryTitle'),
        description: t('admin.services.toast.assignCategoryDescription'),
        variant: 'destructive',
      });
      return;
    }

    const sourceColumnId = categoriesEnabled ? (sourceService.categoryId ?? UNCATEGORIZED_VALUE) : UNCATEGORIZED_VALUE;
    const buckets = buildServiceBuckets(services);
    const sourceBucket = buckets.get(sourceColumnId) ?? [];
    const sourceIndex = sourceBucket.findIndex((service) => service.id === serviceId);
    if (sourceIndex < 0) return;

    const [movingService] = sourceBucket.splice(sourceIndex, 1);
    const targetBucket = buckets.get(targetColumnId) ?? [];
    const boundedTargetIndex = Math.max(0, Math.min(targetIndex, targetBucket.length));
    const normalizedTargetIndex =
      sourceColumnId === targetColumnId && sourceIndex < boundedTargetIndex
        ? boundedTargetIndex - 1
        : boundedTargetIndex;
    targetBucket.splice(normalizedTargetIndex, 0, movingService);

    if (!buckets.has(targetColumnId)) {
      buckets.set(targetColumnId, targetBucket);
    }

    const touchedColumns = new Set([sourceColumnId, targetColumnId]);
    const updates: Array<Promise<unknown>> = [];
    touchedColumns.forEach((columnId) => {
      const columnServices = buckets.get(columnId) ?? [];
      columnServices.forEach((service, index) => {
        const nextCategoryId = categoriesEnabled
          ? (columnId === UNCATEGORIZED_VALUE ? null : columnId)
          : service.categoryId ?? null;
        if (categoriesEnabled && nextCategoryId === null) {
          return;
        }
        const currentCategoryId = service.categoryId ?? null;
        const currentPosition = service.position ?? 0;
        const categoryChanged = nextCategoryId !== currentCategoryId;
        const positionChanged = index !== currentPosition;

        if (categoryChanged || positionChanged) {
          const payload: Partial<Service> = { position: index };
          if (categoryChanged) {
            payload.categoryId = nextCategoryId;
          }
          updates.push(updateService(service.id, payload));
        }
      });
    });

    if (updates.length === 0) return;

    setIsPersistingServiceOrder(true);
    try {
      await Promise.all(updates);
      await Promise.all([servicesQuery.refetch(), categoriesQuery.refetch()]);
      dispatchServicesUpdated({ source: 'admin-services' });
    } catch (error) {
      toast({
        title: t('admin.common.error'),
        description: t('admin.services.toast.saveServiceError'),
        variant: 'destructive',
      });
    } finally {
      setIsPersistingServiceOrder(false);
    }
  };

  const handleCategoryDragStart = (event: React.DragEvent<HTMLDivElement>, categoryId: string) => {
    if (isPersistingCategoryOrder || isPersistingServiceOrder) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(CATEGORY_DRAG_MIME, categoryId);
    event.dataTransfer.setData('text/plain', categoryId);
    setDraggingCategoryId(categoryId);
    setDragOverCategoryId(categoryId);
  };

  const handleCategoryDragOver = (event: React.DragEvent<HTMLDivElement>, categoryId: string) => {
    event.preventDefault();
    if (!draggingCategoryId) return;
    event.dataTransfer.dropEffect = 'move';
    const bounds = event.currentTarget.getBoundingClientRect();
    const middleY = bounds.top + bounds.height / 2;
    setDragOverCategoryPosition(event.clientY <= middleY ? 'before' : 'after');
    setDragOverCategoryId(categoryId);
  };

  const handleCategoryDrop = async (event: React.DragEvent<HTMLDivElement>, targetCategoryId: string) => {
    event.preventDefault();
    const sourceCategoryId = event.dataTransfer.getData(CATEGORY_DRAG_MIME) || event.dataTransfer.getData('text/plain');
    if (!sourceCategoryId || sourceCategoryId === targetCategoryId) {
      resetDragState();
      return;
    }

    const fromIndex = orderedCategories.findIndex((category) => category.id === sourceCategoryId);
    const toIndex = orderedCategories.findIndex((category) => category.id === targetCategoryId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      resetDragState();
      return;
    }

    const insertIndex = toIndex + (dragOverCategoryPosition === 'after' ? 1 : 0);
    await persistCategoryOrder(reorderByInsertIndex(orderedCategories, fromIndex, insertIndex));
    resetDragState();
  };

  const handleServiceDragStart = (event: React.DragEvent<HTMLDivElement>, serviceId: string) => {
    if (isPersistingCategoryOrder || isPersistingServiceOrder) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(SERVICE_DRAG_MIME, serviceId);
    event.dataTransfer.setData('text/plain', serviceId);
    setDraggingServiceId(serviceId);
    setDragOverServiceId(serviceId);
  };

  const handleServiceDragOverColumn = (event: React.DragEvent<HTMLDivElement>, columnId: string) => {
    event.preventDefault();
    if (!draggingServiceId) return;
    event.dataTransfer.dropEffect = 'move';
    setDragOverServiceColumnId(columnId);
    setDragOverServiceId(null);
    setDragOverServicePosition('after');
  };

  const handleServiceDragOverCard = (
    event: React.DragEvent<HTMLDivElement>,
    columnId: string,
    serviceId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!draggingServiceId) return;
    event.dataTransfer.dropEffect = 'move';
    const bounds = event.currentTarget.getBoundingClientRect();
    const middleY = bounds.top + bounds.height / 2;
    setDragOverServicePosition(event.clientY <= middleY ? 'before' : 'after');
    setDragOverServiceColumnId(columnId);
    setDragOverServiceId(serviceId);
  };

  const handleServiceDropAtColumnEnd = async (
    event: React.DragEvent<HTMLDivElement>,
    columnId: string,
  ) => {
    event.preventDefault();
    const serviceId = event.dataTransfer.getData(SERVICE_DRAG_MIME) || event.dataTransfer.getData('text/plain');
    if (!serviceId) {
      resetDragState();
      return;
    }
    const targetColumn = serviceColumns.find((column) => column.id === columnId);
    await persistServiceDrop(serviceId, columnId, targetColumn?.services.length ?? 0);
    resetDragState();
  };

  const handleServiceDropBeforeCard = async (
    event: React.DragEvent<HTMLDivElement>,
    columnId: string,
    targetServiceId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const serviceId = event.dataTransfer.getData(SERVICE_DRAG_MIME) || event.dataTransfer.getData('text/plain');
    if (!serviceId) {
      resetDragState();
      return;
    }

    const targetColumn = serviceColumns.find((column) => column.id === columnId);
    const targetIndex = targetColumn?.services.findIndex((service) => service.id === targetServiceId) ?? -1;
    const insertIndex = targetIndex + (dragOverServicePosition === 'after' ? 1 : 0);
    await persistServiceDrop(serviceId, columnId, insertIndex >= 0 ? insertIndex : 0);
    resetDragState();
  };

  const handleToggleCategories = async (enabled: boolean) => {
    if (!settings) return;
    setIsSavingSettings(true);
    try {
      const updated = await updateSiteSettings({
        ...settings,
        services: {
          ...settings.services,
          categoriesEnabled: enabled,
        },
      });
      dispatchSiteSettingsUpdated(updated);
      dispatchServicesUpdated({ source: 'admin-services' });
      const pendingNotice = enabled && uncategorizedServices.length > 0
        ? t('admin.services.toast.pendingUncategorizedNotice', { count: uncategorizedServices.length })
        : '';
      toast({
        title: enabled ? t('admin.services.toast.categorizationEnabledTitle') : t('admin.services.toast.categorizationDisabledTitle'),
        description: enabled
          ? t('admin.services.toast.categorizationEnabledDescription', {
              pendingNotice: pendingNotice ? ` ${pendingNotice}` : '',
            })
          : t('admin.services.toast.categorizationDisabledDescription'),
      });
      if (enabled && uncategorizedServices.length > 0) {
        toast({
          title: t('admin.services.toast.assignPendingCategoriesTitle'),
          description: t('admin.services.toast.assignPendingCategoriesDescription'),
        });
      }
    } catch (error) {
      toast({
        title: t('admin.services.toast.updateSettingsErrorTitle'),
        description: error instanceof Error ? error.message : t('admin.services.toast.updateSettingsErrorDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="pl-12 md:pl-0">
          <h1 className="text-3xl font-bold text-foreground">{t('admin.services.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('admin.services.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          {categoriesEnabled && (
            <Button variant="outline" onClick={() => openCategoryDialog()}>
              <FolderTree className="w-4 h-4 mr-2" />
              {t('admin.services.actions.newCategory')}
            </Button>
          )}
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            {t('admin.services.actions.newService')}
          </Button>
        </div>
      </div>

      {/* Preferences */}
      <div className={cn('grid gap-6', categoriesEnabled ? 'lg:grid-cols-4' : 'grid-cols-1')}>
        <Card variant="elevated" className={cn(categoriesEnabled ? 'lg:col-span-1' : 'w-full')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              {t('admin.services.presentation.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="font-medium text-sm text-foreground">{t('admin.services.presentation.groupByCategories')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('admin.services.presentation.groupByCategoriesDescription')}
                </p>
              </div>
              <Switch
                checked={categoriesEnabled}
                disabled={!settings || isSavingSettings}
                onCheckedChange={handleToggleCategories}
              />
            </div>
            {categoriesEnabled && (
              <>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    {t('admin.services.presentation.categorizationActive')}
                  </div>
                  <p className="mt-2">
                    {t('admin.services.presentation.categorizationActiveDescription')}
                  </p>
                </div>
                {uncategorizedServices.length > 0 && (
                  <div className="rounded-xl border border-amber-200/60 bg-amber-50 text-amber-700 text-xs p-3">
                    {t('admin.services.presentation.uncategorizedWarning', { count: uncategorizedServices.length })}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Categories */}
        {categoriesEnabled && (
          <Card variant="elevated" className="lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-primary" />
                  {t('admin.services.categories.title')}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('admin.services.categories.description')}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
                </div>
              ) : orderedCategories.length > 0 ? (
                <div className="space-y-2.5">
                  <p className="text-xs text-muted-foreground">{t('admin.spotlight.dragToReorder')}</p>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
                    {orderedCategories.map((category) => {
                      const count = orderedServices.filter((service) => service.categoryId === category.id).length;
                      const isDragging = draggingCategoryId === category.id;
                      const isDragOver = dragOverCategoryId === category.id && draggingCategoryId !== category.id;
                      return (
                        <div
                          key={category.id}
                          draggable={!isPersistingCategoryOrder && !isPersistingServiceOrder}
                          onDragStart={(event) => handleCategoryDragStart(event, category.id)}
                          onDragOver={(event) => handleCategoryDragOver(event, category.id)}
                          onDrop={(event) => void handleCategoryDrop(event, category.id)}
                          onDragEnd={resetDragState}
                          className={cn(
                            'relative rounded-xl border border-border p-4 bg-background/60 flex items-start justify-between gap-3 transition-all duration-200 cursor-grab active:cursor-grabbing select-none',
                            isDragging && 'bg-primary/10 border-primary/40 shadow-lg scale-[0.99]',
                            isDragOver && 'ring-2 ring-primary/30 bg-primary/5',
                          )}
                        >
                          {isDragOver && dragOverCategoryPosition === 'before' && (
                            <span className="pointer-events-none absolute -top-[1px] left-3 right-3 h-[2px] rounded-full bg-primary" />
                          )}
                          {isDragOver && dragOverCategoryPosition === 'after' && (
                            <span className="pointer-events-none absolute -bottom-[1px] left-3 right-3 h-[2px] rounded-full bg-primary" />
                          )}
                          <div className="flex items-start gap-3">
                            <GripVertical className={cn('w-4 h-4 mt-0.5', isDragging ? 'text-primary' : 'text-muted-foreground')} />
                            <div className="space-y-1">
                              <p className="font-semibold text-foreground">{category.name}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {category.description || t('admin.services.categories.noDescription')}
                              </p>
                              <span className="text-[11px] text-muted-foreground">
                                {t('admin.services.categories.serviceCount', { count })}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openCategoryDialog(category)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openCategoryDeleteDialog(category.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={FolderTree}
                  title={t('admin.services.categories.emptyTitle')}
                  description={t('admin.services.categories.emptyDescription')}
                  action={{ label: t('admin.services.actions.createCategory'), onClick: () => openCategoryDialog() }}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Services Grid */}
      {isLoading ? (
        <div className="mt-2 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : services.length > 0 ? (
        <div className="mt-2 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{t('admin.spotlight.dragToReorder')}</p>
            {(isPersistingCategoryOrder || isPersistingServiceOrder) && (
              <div className="inline-flex items-center gap-2 text-xs text-primary">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('admin.common.saving')}
              </div>
            )}
          </div>
          <div className={cn('pb-2', categoriesEnabled ? 'flex gap-4 overflow-x-auto' : 'block')}>
            {serviceColumns.map((column) => {
              const isColumnDragOver = dragOverServiceColumnId === column.id && !dragOverServiceId;
              return (
                <Card
                  key={column.id}
                  variant="elevated"
                  className={cn(
                    categoriesEnabled
                      ? 'w-[320px] min-w-[320px] max-w-[320px] shrink-0'
                      : 'w-full min-w-0 max-w-none',
                    'border border-border/70 bg-background/70',
                    isColumnDragOver && 'ring-2 ring-primary/30 border-primary/40',
                  )}
                >
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-base flex items-center justify-between gap-2">
                      <span className="truncate">{column.name}</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        {t('admin.services.categories.serviceCount', { count: column.services.length })}
                      </span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground line-clamp-2">{column.description}</p>
                  </CardHeader>
                  <CardContent
                    className={cn(
                      'relative min-h-[220px]',
                      categoriesEnabled
                        ? 'space-y-2'
                        : 'grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 content-start',
                    )}
                    onDragOver={(event) => handleServiceDragOverColumn(event, column.id)}
                    onDrop={(event) => void handleServiceDropAtColumnEnd(event, column.id)}
                  >
                    {isColumnDragOver && (
                      <span className="pointer-events-none absolute bottom-1 left-3 right-3 h-[2px] rounded-full bg-primary" />
                    )}
                    {column.services.map((service) => {
                      const priceDisplay = getPriceDisplay(service);
                      const isServiceDragging = draggingServiceId === service.id;
                      const isServiceDropTarget = dragOverServiceId === service.id && draggingServiceId !== service.id;
                      return (
                        <div
                          key={service.id}
                          draggable={!isPersistingCategoryOrder && !isPersistingServiceOrder}
                          onDragStart={(event) => handleServiceDragStart(event, service.id)}
                          onDragOver={(event) => handleServiceDragOverCard(event, column.id, service.id)}
                          onDrop={(event) => void handleServiceDropBeforeCard(event, column.id, service.id)}
                          onDragEnd={resetDragState}
                          className={cn(
                            'relative rounded-xl border border-border bg-card/70 p-3 space-y-2 transition-all duration-150 cursor-grab active:cursor-grabbing select-none',
                            isServiceDragging && 'bg-primary/10 border-primary/40 shadow-md scale-[0.99] opacity-80',
                            isServiceDropTarget && 'ring-2 ring-primary/30 border-primary/40',
                          )}
                        >
                          {isServiceDropTarget && dragOverServicePosition === 'before' && (
                            <span className="pointer-events-none absolute -top-[1px] left-2 right-2 h-[2px] rounded-full bg-primary" />
                          )}
                          {isServiceDropTarget && dragOverServicePosition === 'after' && (
                            <span className="pointer-events-none absolute -bottom-[1px] left-2 right-2 h-[2px] rounded-full bg-primary" />
                          )}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              <GripVertical className={cn('w-4 h-4 mt-0.5 shrink-0', isServiceDragging ? 'text-primary' : 'text-muted-foreground')} />
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-foreground truncate">{service.name}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">{service.description}</p>
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(service)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(service.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="ml-6 flex items-center text-xs text-muted-foreground">
                              <Clock className="w-3 h-3 mr-1" />
                              {t('appointmentEditor.durationMinutes', { minutes: service.duration })}
                            </div>
                            <div className="text-right">
                              {priceDisplay.hasOffer && (
                                <div className="text-[11px] line-through text-muted-foreground">{service.price}€</div>
                              )}
                              <span className="text-lg font-bold text-primary">{priceDisplay.finalPrice}€</span>
                            </div>
                          </div>
                          {priceDisplay.hasOffer && service.appliedOffer && (
                            <div className="flex items-center gap-2 text-[11px] text-primary bg-primary/5 border border-primary/20 rounded-lg px-2.5 py-1.5">
                              <Percent className="w-3 h-3" />
                              {t('admin.services.offerSavings', {
                                offerName: service.appliedOffer.name,
                                amount: service.appliedOffer.amountOff.toFixed(2),
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {column.services.length === 0 && (
                      <div
                        className={cn(
                          'rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground',
                          !categoriesEnabled && 'col-span-full',
                        )}
                      >
                        {t('admin.services.emptyTitle')}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Scissors}
          title={t('admin.services.emptyTitle')}
          description={t('admin.services.emptyDescription')}
          action={{ label: t('admin.services.actions.createService'), onClick: openCreateDialog }}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService ? t('admin.services.dialog.editServiceTitle') : t('admin.services.dialog.newServiceTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('admin.services.dialog.serviceDescription')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="name">{t('admin.services.fields.name')}</Label>
                  <InlineTranslationPopover
                    entityType="service"
                    entityId={editingService?.id}
                    fieldKey="name"
                    onUpdated={async () => {
                      await servicesQuery.refetch();
                    }}
                  />
                </div>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('admin.services.fields.namePlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="description">{t('admin.services.fields.description')}</Label>
                  <InlineTranslationPopover
                    entityType="service"
                    entityId={editingService?.id}
                    fieldKey="description"
                    onUpdated={async () => {
                      await servicesQuery.refetch();
                    }}
                  />
                </div>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('admin.services.fields.descriptionPlaceholder')}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">{t('admin.services.fields.price')}</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="18"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">{t('admin.services.fields.duration')}</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="5"
                    step="5"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="30"
                    required
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {t('admin.services.fields.durationHint')}
                  </p>
                </div>
              </div>
              {categoriesEnabled && (
                <div className="space-y-2">
                  <Label>{t('admin.services.fields.category')}</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, categoryId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('admin.services.fields.selectCategory')} />
                    </SelectTrigger>
                    <SelectContent>
                      {orderedCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {orderedCategories.length === 0 && (
                    <p className="text-xs text-destructive">{t('admin.services.fields.createCategoryFirst')}</p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('appointmentEditor.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingService ? t('admin.services.actions.saveChanges') : t('admin.services.actions.createService')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? t('admin.services.dialog.editCategoryTitle') : t('admin.services.dialog.newCategoryTitle')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('admin.services.dialog.categoryDescription')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCategorySubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="category-name">{t('admin.services.fields.name')}</Label>
                  <InlineTranslationPopover
                    entityType="service_category"
                    entityId={editingCategory?.id}
                    fieldKey="name"
                    onUpdated={async () => {
                      await categoriesQuery.refetch();
                    }}
                  />
                </div>
                <Input
                  id="category-name"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder={t('admin.services.dialog.categoryNamePlaceholder')}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="category-description">{t('admin.services.fields.description')}</Label>
                  <InlineTranslationPopover
                    entityType="service_category"
                    entityId={editingCategory?.id}
                    fieldKey="description"
                    onUpdated={async () => {
                      await categoriesQuery.refetch();
                    }}
                  />
                </div>
                <Textarea
                  id="category-description"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder={t('admin.services.dialog.categoryDescriptionPlaceholder')}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
                {t('appointmentEditor.cancel')}
              </Button>
              <Button type="submit" disabled={isCategorySubmitting}>
                {isCategorySubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingCategory ? t('admin.services.actions.saveChanges') : t('admin.services.actions.createCategory')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.services.deleteServiceDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.services.deleteServiceDialog.description')}
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

      <AlertDialog open={isCategoryDeleteDialogOpen} onOpenChange={setIsCategoryDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.services.deleteCategoryDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.services.deleteCategoryDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('appointmentEditor.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('admin.roles.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default AdminServices;
